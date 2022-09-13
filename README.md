# Uniswap Routing API

This repository contains routing API for the Uniswap V3 protocol.

It deploys an API to AWS that uses @uniswap/smart-order-router to search for the most efficient way to swap token A for token B.

## Development

The develop on the Routing API you must have an AWS account where you can deploy your API for testing.

### Deploying the API

The best way to develop and test the API is to deploy your own instance to AWS.

1. Install and configure [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html) and [AWS CDK V1](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html).
2. Create .env file in the root directory of the project with :
   ```
   THROTTLE_PER_FIVE_MINS = '' # Optional
   JSON_RPC_PROVIDER_{CHAIN ID} = { RPC Provider}
   # RPC Providers must be set for the following CHAIN IDs:
   # MAINNET = 1
   # ROPSTEN = 3
   # RINKEBY = 4
   # GÖRLI = 5
   # KOVAN = 42
   # OPTIMISM = 10
   # OPTIMISTIC_KOVAN = 69
   # ARBITRUM_ONE = 42161
   # ARBITRUM_RINKEBY = 421611
   # POLYGON = 137
   # POLYGON_MUMBAI = 80001
   ```
3. Install and build the package
   ```
   npm install && npm run build
   ```
4. To deploy the API run:
   ```
   cdk deploy RoutingAPIStack
   ```
   This will deploy to the default account your AWS CLI is configured for. Once complete it will output something like:
   ```
   RoutingAPIStack.Url = https://...
   ```
   You can then try it out:
   ```
   curl --request GET '<INSERT_YOUR_URL_HERE>/quote?tokenInAddress=0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2&tokenInChainId=1&tokenOutAddress=0x1f9840a85d5af5bf1d1762f925bdaddc4201f984&tokenOutChainId=1&amount=100&type=exactIn'
   ```
### Tenderly Simulation
1. To get a more accurate estimate of the transaction's gas cost, request a tenderly simulation along with the swap. This is done by setting the optional queryparam "simulateFromAddress". For example:
```
curl --request GET '<INSERT_YOUR_URL_HERE>/quote?tokenInAddress=<0x...>&simulateFromAddress=<FROM_ADDRESS>&...'
```

### Integration Tests

The integration tests fetch quotes from your deployed API, then execute the swaps on a Hardhat mainnet fork.

1. First deploy your test API using the intructions above. Then update your `.env` file with the URL of the API, and the RPC URL of an archive node:

   ```
   UNISWAP_ROUTING_API='...'
   ARCHIVE_NODE_RPC='...'
   ```

2. Run the tests with:
   ```
   npm run integ-test
   ```
