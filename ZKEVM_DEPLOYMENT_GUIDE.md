# zkEVM Testnet Deployment Guide

This guide outlines the steps required to configure the Uniswap Routing API to support zkEVM testnet (Chain ID: 13473) with a custom subgraph and deploy to AWS ap-southeast-2 region.

## Prerequisites

- AWS CLI authenticated with appropriate credentials
- Access to your custom zkEVM subgraph URL
- RPC endpoint for zkEVM testnet (Chain ID: 13473)

## Progress Summary

- ✅ Step 1: Update SUPPORTED_CHAINS Array - **COMPLETE**
- ⚠️ Step 2: Configure Custom Subgraph URLs - **PARTIALLY COMPLETE** (needs actual URLs)
- ⚠️ Step 3: Add Chain Protocol Configuration - **PARTIALLY COMPLETE** (needs zkEVM entries)
- ✅ Step 4: Configure RPC Provider - **COMPLETE**
- ⚠️ Step 5: Update AWS Region to ap-southeast-2 - **PARTIALLY COMPLETE** (pipeline done, beta/prod pending)
- ⏳ Step 6: Update AWS Secrets - **PENDING**
- ⏳ Step 7: Deploy to AWS - **PENDING**
- ⏳ Step 8: Verify Deployment - **PENDING**

---

## Step 1: Update SUPPORTED_CHAINS Array ✅ COMPLETE

**File:** `lib/handlers/injector-sor.ts`

**Status:** Already completed. The zkEVM chain constant has been created and added to SUPPORTED_CHAINS.

**Current implementation:**
```typescript
// lib/constants/zk-evm.ts
export const ZK_EVM_TESTNET_CHAIN_ID = 13473

// lib/handlers/injector-sor.ts
import { ZK_EVM_TESTNET_CHAIN_ID } from '../constants/zk-evm'

export const SUPPORTED_CHAINS: ChainId[] = [ZK_EVM_TESTNET_CHAIN_ID]
```

**Note:** All other chains have been removed to simplify the deployment to zkEVM only.

---

## Step 2: Configure Custom Subgraph URLs ⚠️ PARTIALLY COMPLETE

**File:** `lib/cron/cache-config.ts`

**Status:** Override functions have been created but need actual subgraph URLs populated.

**Current state:** The override functions are set up but return empty strings:

```typescript
export const v3SubgraphUrlOverride = (chainId: number) => {
  switch (chainId) {
    case ZK_EVM_TESTNET_CHAIN_ID:
      return '' // ⚠️ TODO: Add your actual subgraph URL here
    default:
      return undefined
  }
}

export const v2SubgraphUrlOverride = (chainId: number) => {
  switch (chainId) {
    case ZK_EVM_TESTNET_CHAIN_ID:
      return '' // ⚠️ TODO: Add your actual subgraph URL here (if you have V2 pools)
    default:
      return undefined
  }
}

export const v4SubgraphUrlOverride = (chainId: number) => {
  switch (chainId) {
    case ZK_EVM_TESTNET_CHAIN_ID:
      return '' // ⚠️ TODO: Add your actual subgraph URL here (if you have V4 pools)
    default:
      return undefined
  }
}
```

**Action Required:** Replace the empty strings with your actual subgraph URLs:

```typescript
export const v3SubgraphUrlOverride = (chainId: number) => {
  switch (chainId) {
    case ZK_EVM_TESTNET_CHAIN_ID:
      return 'https://your-custom-zkevm-v3-subgraph.com/graphql' // ← Add your V3 subgraph URL
    default:
      return undefined
  }
}

// Do the same for v2SubgraphUrlOverride and v4SubgraphUrlOverride if needed
```

**Reference:** Lines 56-77 in `lib/cron/cache-config.ts`

---

## Step 3: Add Chain Protocol Configuration ⚠️ PARTIALLY COMPLETE

**File:** `lib/cron/cache-config.ts`

**Status:** The array has been cleaned up but zkEVM protocol configurations need to be added.

**Current state:** Only Mainnet and Sepolia protocols remain (line 106). You need to add zkEVM configurations.

**Action Required:** Add protocol configurations for zkEVM. Add these entries to the `chainProtocols` array after line 106:

```typescript
export const chainProtocols = [
  // TODO: Add protocols for ZK EVM (line 107)

  // ... existing Mainnet/Sepolia configs ...

  // Add zkEVM V3 configuration
  {
    protocol: Protocol.V3,
    chainId: ZK_EVM_TESTNET_CHAIN_ID,
    timeout: 90000,
    provider: new V3SubgraphProvider(
      ZK_EVM_TESTNET_CHAIN_ID,
      3,
      90000,
      true,
      v3TrackedEthThreshold,
      v3UntrackedUsdThreshold,
      v3SubgraphUrlOverride(ZK_EVM_TESTNET_CHAIN_ID)
    ),
  },

  // Add zkEVM V2 configuration (if you have V2 pools)
  {
    protocol: Protocol.V2,
    chainId: ZK_EVM_TESTNET_CHAIN_ID,
    timeout: 90000,
    provider: new V2SubgraphProvider(
      ZK_EVM_TESTNET_CHAIN_ID,
      3,
      90000,
      true,
      1000,
      v2TrackedEthThreshold,
      v2UntrackedUsdThreshold,
      v2SubgraphUrlOverride(ZK_EVM_TESTNET_CHAIN_ID)
    ),
  },

  // Add zkEVM V4 configuration (if you have V4 pools)
  {
    protocol: Protocol.V4,
    chainId: ZK_EVM_TESTNET_CHAIN_ID,
    timeout: 90000,
    provider: new V4SubgraphProvider(
      ZK_EVM_TESTNET_CHAIN_ID,
      3,
      90000,
      true,
      v4TrackedEthThreshold,
      v4BaseZoraTrackedEthThreshold,
      ZORA_HOOKS_FOR_V4_SUBGRAPH_FILTERING,
      v4UntrackedUsdThreshold,
      v4SubgraphUrlOverride(ZK_EVM_TESTNET_CHAIN_ID)
    ),
  },
]
```

**Note:** You can remove the Mainnet and Sepolia configurations if you only want to support zkEVM.

---

## Step 4: Configure RPC Provider ✅ COMPLETE

**File:** `bin/app.ts`

**Status:** Already completed. RPC provider has been configured for zkEVM.

**Current implementation (lines 388-456):**
```typescript
const jsonRpcProviders = {
  ZK_EVM_TESTNET: process.env.ZK_EVM_TESTNET_RPC!,
}
```

**Action Required:** Set the environment variable before deployment:

Create a `.env` file in the project root or set the environment variable:

```bash
export ZK_EVM_TESTNET_RPC="https://your-zkevm-testnet-rpc.com"
```

**Note:** All other RPC providers have been commented out since only zkEVM is being supported.

---

## Step 5: Update AWS Region to ap-southeast-2 ⚠️ PARTIALLY COMPLETE

**File:** `bin/app.ts`

**Status:** Pipeline region has been updated, but Beta and Prod stages still need to be changed.

### 5.1 Update Pipeline Stack Region ✅ COMPLETE

**Current implementation (line 484):**
```typescript
new RoutingAPIPipeline(app, 'RoutingAPIPipelineStack', {
  env: { account: '644039819003', region: 'ap-southeast-2' }, // ✅ Already changed
})
```

### 5.2 Update Beta Stage ⏳ TODO

**File:** `bin/app.ts` (around line 274)

**Action Required:** Change region in beta stage definition:

```typescript
const betaUsEast2Stage = new RoutingAPIStage(this, 'beta-ap-southeast-2', {
  env: { account: '145079444317', region: 'ap-southeast-2' }, // ← Change from us-east-2
  jsonRpcProviders: jsonRpcProviders,
  provisionedConcurrency: 0,
  ethGasStationInfoUrl: ETH_GAS_STATION_INFO_URL,
  chatbotSNSArn: CHATBOT_SNS_ARN,
  stage: STAGE.BETA,
  internalApiKey: 'api-key',
  route53Arn: CHAINS_ROUTE53_ZONE_ARN,
  pinata_key: PINATA_API_KEY,
  pinata_secret: PINATA_API_SECRET,
  hosted_zone: CHAINS_HOSTED_ZONE,
  tenderlyUser: TENDERLY_USER,
  tenderlyProject: TENDERLY_PROJECT,
  tenderlyAccessKey: TENDERLY_ACCESS_KEY,
  tenderlySimulationApiKey: TENDERLY_SIMULATION_API_KEY,
  unicornSecret: UNICORN_SECRET,
})
```

### 5.3 Update Prod Stage ⏳ TODO

**File:** `bin/app.ts` (around line 306)

**Action Required:** Change region in prod stage definition:

```typescript
const prodUsEast2Stage = new RoutingAPIStage(this, 'prod-ap-southeast-2', {
  env: { account: '606857263320', region: 'ap-southeast-2' }, // ← Change from us-east-2
  jsonRpcProviders: jsonRpcProviders,
  provisionedConcurrency: 30,
  ethGasStationInfoUrl: ETH_GAS_STATION_INFO_URL,
  chatbotSNSArn: CHATBOT_SNS_ARN,
  stage: STAGE.PROD,
  internalApiKey: 'api-key',
  route53Arn: CHAINS_ROUTE53_ZONE_ARN,
  pinata_key: PINATA_API_KEY,
  pinata_secret: PINATA_API_SECRET,
  hosted_zone: CHAINS_HOSTED_ZONE,
  tenderlyUser: TENDERLY_USER,
  tenderlyProject: TENDERLY_PROJECT,
  tenderlyAccessKey: TENDERLY_ACCESS_KEY,
  tenderlySimulationApiKey: TENDERLY_SIMULATION_API_KEY,
  unicornSecret: UNICORN_SECRET,
})
```

**Note:** You may also need to update the AWS account IDs if deploying to different accounts in ap-southeast-2.

---

## Step 6: Update AWS Secrets ⏳ PENDING

If your deployment uses AWS Secrets Manager for RPC providers, add the zkEVM RPC to your secrets:

```bash
aws secretsmanager update-secret \
  --region ap-southeast-2 \
  --secret-id routing-api-rpc-secrets \
  --secret-string '{"ZK_EVM_TESTNET":"https://your-zkevm-testnet-rpc.com"}'
```

Alternatively, you can manage this through the AWS Console.

---

## Step 7: Deploy to AWS ⏳ PENDING

### 7.1 Bootstrap CDK (if first time in ap-southeast-2)

```bash
cdk bootstrap aws://ACCOUNT-ID/ap-southeast-2
```

Replace `ACCOUNT-ID` with your AWS account ID (e.g., 644039819003).

### 7.2 Build the Project

```bash
npm run build
```

### 7.3 Synthesize the Stack

```bash
cdk synth
```

This will generate CloudFormation templates and validate your configuration.

### 7.4 Deploy

```bash
cdk deploy --all --region ap-southeast-2
```

Or deploy specific stages:

```bash
# Deploy beta
cdk deploy beta-ap-southeast-2 --region ap-southeast-2

# Deploy prod
cdk deploy prod-ap-southeast-2 --region ap-southeast-2
```

---

## Step 8: Verify Deployment ⏳ PENDING

### 8.1 Check Lambda Functions

```bash
aws lambda list-functions --region ap-southeast-2 | grep routing-api
```

### 8.2 Check CloudFormation Stacks

```bash
aws cloudformation list-stacks --region ap-southeast-2 --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE
```

### 8.3 Test the API

Get the API endpoint from CDK output or API Gateway:

```bash
# Get the API Gateway endpoint
aws apigateway get-rest-apis --region ap-southeast-2
```

Test with a quote request:

```bash
curl "https://your-api-endpoint/quote?chainId=13473&tokenIn=0x...&tokenOut=0x...&amount=1000000"
```

Replace:
- `your-api-endpoint` with your actual API Gateway endpoint
- `tokenIn` with the zkEVM testnet address of the input token
- `tokenOut` with the zkEVM testnet address of the output token
- `amount` with the amount in wei/base units

---

## Troubleshooting

### Chain ID Not Recognized

If you get errors about the chain ID not being recognized:
- Verify that `ZK_EVM_TESTNET_CHAIN_ID = 13473` in `lib/constants/zk-evm.ts`
- Ensure it's properly imported in all files that use it

### Subgraph Connection Issues

- Verify your custom subgraph URL is accessible
- Check if authentication/API keys are required
- Test the GraphQL endpoint directly with a tool like Postman or curl
- Ensure the subgraph is fully synced for chain 13473

### RPC Provider Issues

- Verify the RPC endpoint is correct and accessible
- Check rate limits on your RPC provider
- Ensure the `ZK_EVM_TESTNET_RPC` environment variable is properly set
- Test the RPC endpoint directly:
  ```bash
  curl -X POST -H "Content-Type: application/json" \
    --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
    $ZK_EVM_TESTNET_RPC
  ```

### Build Errors

- Run `npm install` to ensure all dependencies are installed
- Check for TypeScript errors with `npm run build`
- Ensure all TODOs in the code have been addressed

### Region-Specific Issues

- Some AWS services may not be available in ap-southeast-2
- Check CloudWatch logs in the correct region
- Verify IAM roles have proper permissions in the new region

---

## Additional Notes

- **S3 Cache:** Pool cache will be stored in S3 in ap-southeast-2
- **DynamoDB:** Token list cache will use DynamoDB in ap-southeast-2
- **CloudWatch:** Logs and metrics will be in ap-southeast-2
- **Cost:** ap-southeast-2 pricing may differ from us-east-2
- **Chain ID:** zkEVM testnet uses Chain ID 13473 (not 1442 as originally documented)

---

## Quick Checklist Before Deployment

Before running `cdk deploy`, ensure:

- [ ] Subgraph URLs are populated in `lib/cron/cache-config.ts` (Step 2)
- [ ] Protocol configurations added for zkEVM in `lib/cron/cache-config.ts` (Step 3)
- [ ] `ZK_EVM_TESTNET_RPC` environment variable is set (Step 4)
- [ ] Beta and Prod stage regions updated to `ap-southeast-2` (Step 5)
- [ ] AWS CLI is authenticated and configured for ap-southeast-2
- [ ] You've run `npm run build` successfully
- [ ] You've run `cdk synth` without errors

---

## References

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [Uniswap Smart Order Router](https://github.com/Uniswap/smart-order-router)
- [zkEVM Documentation](https://docs.polygon.technology/zkevm/)
