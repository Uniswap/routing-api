# Scripts

## Overview

Utility scripts for local development and testing.

## Key Files

- `get_quote.ts` - Test script to fetch quotes from deployed API

## Usage

```bash
ts-node --project=tsconfig.cdk.json scripts/get_quote.ts
```

Requires `UNISWAP_ROUTING_API` environment variable set.

## Auto-Update Instructions

After changes to files in this directory or subdirectories, run `/update-claude-md`
to keep this documentation synchronized with the codebase.
