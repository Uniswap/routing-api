import pinataSDK from '@pinata/sdk'
import { ChainId, V2SubgraphProvider, V3SubgraphProvider } from '@uniswap/smart-order-router'
import { EventBridgeEvent, ScheduledHandler } from 'aws-lambda'
import { Route53, STS } from 'aws-sdk'
import { default as bunyan, default as Logger } from 'bunyan'
import fs from 'fs'

const PARENT = '/tmp/temp/'

const DIRECTORY = '/tmp/temp/v1/pools/'

enum VERSION {
  V2 = 'v2',
  V3 = 'v3',
}

// add more chains here
const chains: { fileName: string; chain: ChainId }[] = [
  { fileName: 'mainnet.json', chain: ChainId.MAINNET },
  { fileName: 'rinkeby.json', chain: ChainId.RINKEBY },
]

const pinata = pinataSDK(process.env.PINATA_API_KEY!, process.env.PINATA_API_SECRET!)

const handler: ScheduledHandler = async (event: EventBridgeEvent<string, void>) => {
  const log: Logger = bunyan.createLogger({
    name: 'RoutingLambda',
    serializers: bunyan.stdSerializers,
    level: 'info',
    requestId: event.id,
  })

  const sts = new STS()
  const stsParams = {
    RoleArn: process.env.ROLE_ARN!,
    RoleSessionName: `UpdateApiRoute53Role`,
  }

  // init route53 with credentials
  let data
  let route53
  try {
    data = await sts.assumeRole(stsParams).promise()
  } catch (err) {
    log.error({ err }, `Error assuming role`)
    throw err
  }

  log.info(`Role assumed`)
  try {
    const accessKeyId = data?.Credentials?.AccessKeyId
    const secretAccess = data?.Credentials?.SecretAccessKey
    const sessionKey = data?.Credentials?.SessionToken
    route53 = new Route53({
      credentials: {
        accessKeyId: accessKeyId!,
        secretAccessKey: secretAccess!,
        sessionToken: sessionKey,
      },
    })
  } catch (err: any) {
    log.error({ err }, 'Route53 not initialized with correct credentials')
    throw err
  }

  for (let i = 0; i < chains.length; i++) {
    const { fileName, chain } = chains[i]
    log.info(`Getting V3 pools for chain ${chain}`)
    const subgraphProviderV3 = new V3SubgraphProvider(chain, 3, 90000)
    const pools = await subgraphProviderV3.getPools()
    log.info(`Got ${pools.length} V3 pools for chain ${chain}`)
    const poolString = JSON.stringify(pools)

    // create directory and file for v3
    //  file: /tmp/temp/v1/pools/v3mainnet.json
    const directoryV3 = DIRECTORY.concat(VERSION.V3).concat(fileName)
    fs.mkdirSync(DIRECTORY, { recursive: true })
    fs.writeFileSync(directoryV3, poolString)

    log.info(`Getting V2 pairs for chain ${chain}`)
    const subgraphProviderV2 = new V2SubgraphProvider(chain, 3)
    const pairs = await subgraphProviderV2.getPools()
    log.info(`Got ${pairs.length} V2 pairs for chain ${chain}`)
    const pairString = JSON.stringify(pairs)

    // file: /tmp/temp/v1/pools/v2mainnet.json
    const directoryV2 = DIRECTORY.concat(VERSION.V2).concat(fileName)
    fs.writeFileSync(directoryV2, pairString)
  }

  // pins everything under '/tmp/` which should include mainnet.txt and rinkeby.txt
  // only have to pin once for all chains
  let result
  let hash
  try {
    log.info({ result }, `Pinning to pinata: ${PARENT}`)
    result = await pinata.pinFromFS(PARENT)
    const url = `https://ipfs.io/ipfs/${result.IpfsHash}`
    hash = result.IpfsHash

    log.info({ result }, `Successful pinning. IPFS hash: ${hash} and url : ${url}`)
  } catch (err) {
    log.error({ err }, 'Error pinning')
    throw err
  }

  // link resulting hash to DNS
  const domain = process.env.STAGE == 'prod' ? 'api.uniswap.org' : 'beta.api.uniswap.org'
  var params = {
    ChangeBatch: {
      Changes: [
        {
          Action: 'UPSERT',
          ResourceRecordSet: {
            Name: domain,
            ResourceRecords: [
              {
                Value: `\"dnslink=/ipfs/${hash}\"`,
              },
            ],
            TTL: 60,
            Type: 'TXT',
          },
        },
      ],
    },
    HostedZoneId: process.env.HOSTED_ZONE!,
  }
  try {
    log.info({ params }, `Updating record set`)
    const data = await route53.changeResourceRecordSets(params).promise()
    log.info(`Successful record update: ${data}`)
  } catch (err) {
    log.error({ err }, 'Error updating DNS')
    throw err
  }
}
module.exports = { handler }
