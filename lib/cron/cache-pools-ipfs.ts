import pinataSDK from '@pinata/sdk'
import { ID_TO_NETWORK_NAME } from '@uniswap/smart-order-router'
import { EventBridgeEvent, ScheduledHandler } from 'aws-lambda'
import { Route53, STS } from 'aws-sdk'
import { default as bunyan, default as Logger } from 'bunyan'
import fs from 'fs'
import path from 'path'
import { chainProtocols } from './cache-config'

const PARENT = '/tmp/temp/'

const DIRECTORY = '/tmp/temp/v1/pools/'

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

  for (const { chainId, protocol, provider } of chainProtocols) {
    const ipfsFilename = `${ID_TO_NETWORK_NAME(chainId)}.json`
    log.info(`Getting ${protocol} pools for chain ${chainId}`)
    const pools = await provider.getPools()
    log.info(`Got ${pools.length} ${protocol} pools for chain ${chainId}. Will save with filename ${ipfsFilename}`)
    const poolString = JSON.stringify(pools)

    // create directory and file for the chain and protocol
    // e.g: /tmp/temp/v1/pools/v3/mainnet.json
    const parentDirectory = path.join(DIRECTORY, protocol.toLowerCase())
    const fullPath = path.join(DIRECTORY, protocol.toLowerCase(), ipfsFilename)
    fs.mkdirSync(parentDirectory, { recursive: true })
    fs.writeFileSync(fullPath, poolString)
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
