import pinataSDK from '@pinata/sdk';
import { ChainId, SubgraphProvider } from '@uniswap/smart-order-router';
import { EventBridgeEvent, ScheduledHandler } from 'aws-lambda';
import { Route53, STS } from 'aws-sdk';
import { default as bunyan, default as Logger } from 'bunyan';
import fs from 'fs';
import { STAGE } from '../../bin/app';

const PARENT = '/tmp/temp/';
// future: add v2 directory
const DIRECTORY = '/tmp/temp/v1/pools/v3/';

// add more chains here
const chains: { fileName: string; chain: ChainId }[] = [
  { fileName: 'mainnet.json', chain: ChainId.MAINNET },
  { fileName: 'rinkeby.json', chain: ChainId.RINKEBY },
];

const pinata = pinataSDK(
  process.env.PINATA_API_KEY!,
  process.env.PINATA_API_SECRET!
);

const handler: ScheduledHandler = async (
  event: EventBridgeEvent<string, void>
) => {
  const log: Logger = bunyan.createLogger({
    name: 'RoutingLambda',
    serializers: bunyan.stdSerializers,
    level: 'info',
    requestId: event.id,
  });

  if (process.env.STAGE != STAGE.BETA) {
    log.info('Must run this in the beta environment');
    return;
  }

  const sts = new STS();
  const stsParams = {
    RoleArn: process.env.ROLE_ARN!,
    RoleSessionName: `UpdateApiRoute53Role`,
  };

  // init route53 with credentials
  let data;
  let route53;
  try {
    data = await sts.assumeRole(stsParams).promise();
  } catch (err) {
    log.error({ err }, `Error assuming role`);
    throw err;
  }

  log.info(`Role assumed`);
  try {
    const accessKeyId = data?.Credentials?.AccessKeyId;
    const secretAccess = data?.Credentials?.SecretAccessKey;
    route53 = new Route53({
      credentials: {
        accessKeyId: accessKeyId!,
        secretAccessKey: secretAccess!,
      },
    });
  } catch (err: any) {
    log.error({ err }, 'Route53 not initialized with correct credentials');
    throw err;
  }

  for (let i = 0; i < chains.length; i++) {
    const { fileName, chain } = chains[i];
    const subgraphProvider = new SubgraphProvider(chain, 3, 15000);
    const pools = await subgraphProvider.getPools();
    const poolString = JSON.stringify(pools);

    // create directory and file
    fs.mkdirSync(DIRECTORY, { recursive: true });
    fs.writeFileSync(DIRECTORY.concat(fileName), poolString);
  }

  // pins everything under '/tmp/` which should include mainnet.txt and rinkeby.txt
  // only have to pin once for all chains
  let result;
  let hash;
  try {
    result = await pinata.pinFromFS(PARENT);
    const url = `https://ipfs.io/ipfs/${result.IpfsHash}`;
    hash = result.IpfsHash;

    log.info(
      { result },
      `Successful pinning. IPFS hash: ${hash} and url : ${url}`
    );
  } catch (err) {
    log.error({ err }, 'Error pinning');
    throw err;
  }

  // link resulting hash to DNS
  var params = {
    ChangeBatch: {
      Changes: [
        {
          Action: 'UPSERT',
          ResourceRecordSet: {
            Name: 'beta.api.uniswap.com',
            ResourceRecords: [
              {
                Value: `dnslink=/ipfs/${hash}`,
              },
            ],
            TTL: 60,
            Type: 'TXT',
          },
        },
      ],
    },
    HostedZoneId: process.env.HOSTED_ZONE!,
  };
  try {
    const data = await route53.changeResourceRecordSets(params).promise();
    log.info(`Successful record update: ${data}`);
  } catch (err) {
    log.error({ err }, 'Error updating DNS');
    throw err;
  }
};

module.exports = { handler };
