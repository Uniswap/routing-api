import pinataSDK from '@pinata/sdk';
import { ChainId, SubgraphProvider } from '@uniswap/smart-order-router';
import { EventBridgeEvent, ScheduledHandler } from 'aws-lambda';
import { Route53, STS } from 'aws-sdk';
import { default as bunyan, default as Logger } from 'bunyan';
import fs from 'fs';

// if (process.env.STAGE == 'beta') {}

const DIRECTORY = '/tmp/pools/';

// add more chains here
const chains = [ChainId.MAINNET, ChainId.RINKEBY]
const names = ["mainnet.txt", "rinkeby.txt"]

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

  const sts = new STS();
  const stsParams = {
    RoleArn: process.env.ROLE_ARN!,
    RoleSessionName: `UpdateApiRoute53Role`,
  };

  // init route53 with credentials
  let credentials;
  var route53 = new Route53();
  sts.assumeRole(stsParams, (err: any, data: any) => {
    if (err) {
      log.error({ err }, `Error assuming role`);
    } else {
      credentials = data.Credentials;
      route53 = new Route53({ credentials: credentials });
      log.info(`Role assumed`);
    }
  });

  for (let i = 0; i < chains.length; i ++ ) {
    const subgraphProvider = new SubgraphProvider(chains[i], 3, 15000);
    const pools = await subgraphProvider.getPools();
    // TODO : filter pools 
    const poolString = JSON.stringify(pools);

    let fileName = names[i]

    // create directory and file
    fs.mkdirSync(DIRECTORY, { recursive: true });
    fs.writeFileSync(DIRECTORY.concat(fileName), poolString);
  }

    // pins everything under '/tmp/` which should include mainnet.txt and rinkeby.txt
    // only have to pin once for all chains
    let result;
    const results : string[] = []
    try {
      result = await pinata.pinFromFS(DIRECTORY);
      let url = `https://ipfs.io/ipfs/${result.IpfsHash}`;
      results.push(result.IpfsHash)
      
      log.info(
        `Succcessful pinning. IPFS hash: ${result.IpfsHash} and url : ${url}`
      );
    } catch (err) {
        log.error({ err }, 'Error pinning');
      }
      
      // link all chains pool data to DNS
      for (let i = 0; i < chains.length; i++) {
        const result = results[i]
        const fileName = names[i]
        var params = {
            ChangeBatch: {
              Changes: [
                {
                  Action: 'CREATE',
                  ResourceRecordSet: {
                    Name: 'beta.api.uniswap.com',
                    ResourceRecords: [
                      {
                        Value: `dnslink=/ipfs/${result}/${fileName}`,
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
          }
      }
};

module.exports = { handler };