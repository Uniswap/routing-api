# GitHub Workflows

## Overview

CI/CD workflows for linting, testing, and security scanning on pull requests and main branch pushes.

## Key Files

- `lint.yml` - Runs prettier on push/PR, uses bullfrog security
- `test.yml` - Runs `npm run build`, `test:unit`, and `test:integ`
- `trufflehog.yml` - Scans for secrets/credentials in code

## Notes

- All workflows use bullfrog security action in audit mode
- Tests require `GQL_URL` and `GQL_H_ORGN` secrets
- Node 18.x is used across all workflows

## Auto-Update Instructions

After changes to files in this directory or subdirectories, run `/update-claude-md`
to keep this documentation synchronized with the codebase.
