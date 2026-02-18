# ABIs

## Overview

JSON ABI files for Ethereum smart contracts used by the routing API.

## Key Files

- `erc20.json` - Standard ERC20 token interface
- `Permit2.json` - Uniswap Permit2 contract ABI
- `Router.json` - Universal Router contract ABI

## Usage

ABIs are compiled to TypeScript types via typechain:
```
npm run compile-external-types
```

## Auto-Update Instructions

After changes to files in this directory or subdirectories, run `/update-claude-md`
to keep this documentation synchronized with the codebase.
