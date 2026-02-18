# Uniswap Routing API

## Overview

AWS Lambda-based API that uses `@uniswap/smart-order-router` to find optimal swap routes for Uniswap V2/V3/V4 protocols across multiple chains.

## Commands

- `npm run build` - Compile TypeScript and generate contract types
- `npm run test:unit` - Run unit tests (Jest + Mocha)
- `npm run test:integ` - Run integration tests (requires local DynamoDB)
- `npm run test:e2e` - Run end-to-end tests against deployed API
- `npm run fix` - Run prettier and eslint fixes
- `cdk deploy RoutingAPIStack` - Deploy to AWS

## Dependencies

<!-- AUTO-GENERATED - Updated by /update-claude-md -->

- **@uniswap/smart-order-router** - Core routing algorithm
- **@uniswap/sdk-core** - Token/chain definitions
- **@uniswap/v2-sdk, v3-sdk, v4-sdk** - Protocol-specific logic
- **aws-cdk-lib** - Infrastructure as code
- **@middy/core** - Lambda middleware
- **ethers** - Ethereum interactions

## Structure

- `bin/` - CDK app entry and stack definitions
- `lib/handlers/` - Lambda handlers (quote endpoint, caching)
- `lib/rpc/` - RPC provider management with health monitoring
- `lib/graphql/` - GraphQL client for subgraph queries
- `lib/util/` - Shared utilities and configurations
- `test/` - Unit, integration, and e2e tests

## Key Patterns

- Quote handler at `lib/handlers/quote/quote.ts`
- Injector pattern for dependency injection (`lib/handlers/injector-sor.ts`)
- DynamoDB caching for pools and routes
- Multi-chain RPC gateway with failover

## Auto-Update Instructions

After changes to files in this directory or subdirectories, run `/update-claude-md`
to keep this documentation synchronized with the codebase.
