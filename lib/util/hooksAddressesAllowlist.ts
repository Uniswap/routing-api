import { ChainId } from '@uniswap/sdk-core'
import { ADDRESS_ZERO } from '@uniswap/router-sdk'
import fs from 'fs'
import path from 'path'

//Expected format of HookList JSON files
interface TokenEntry {
  symbol: string
  id: string
  name: string
  decimals: string
}

interface PoolEntry {
  id: string
  tvlUSD?: number
  tvlETH?: number
  feeTier?: string
  tickSpacing?: string
  liquidity?: string
  token0?: TokenEntry
  token1?: TokenEntry
}

interface HookEntry {
  address: string
  name: string
  description: string
  audit: string
  version: {
    major: number
    minor: number
    patch: number
  }
  hookStatsAddress: string | null
  pools: PoolEntry[]
}

interface HookFile {
  name: string
  timestamp: string
  version: {
    major: number
    minor: number
    patch: number
  }
  keywords: string[]
  description: string
  logoURI: string
  chains: {
    [chainId: string]: HookEntry[]
  }
}

// A V4SubgraphPool-compatible interface for pools
interface V4PoolData {
  id: string
  feeTier?: string
  tickSpacing?: string
  hooks?: string
  liquidity?: string
  token0?: {
    symbol: string
    id: string
    name: string
    decimals: string
  }
  token1?: {
    symbol: string
    id: string
    name: string
    decimals: string
  }
  tvlETH?: number
  tvlUSD?: number
}

interface HookMetadata {
  address: string
  name: string
  keywords: string[]
}

function loadAllHookFiles(): HookFile[] {
  const hooksDir = path.resolve(process.cwd(), 'lib', 'util', 'hooks', 'prod')
  const hookFiles: HookFile[] = []

  try {
    const files = fs.readdirSync(hooksDir).filter((file) => file.endsWith('.json'))

    for (const file of files) {
      try {
        const filePath = path.join(hooksDir, file)
        const fileContent = fs.readFileSync(filePath, 'utf8')
        const hookFile: HookFile = JSON.parse(fileContent)
        hookFiles.push(hookFile)
      } catch (error) {
        console.warn(`Failed to load hook file ${file}:`, error)
      }
    }
  } catch (error) {
    console.error(`Failed to read hooks directory ${hooksDir}:`, error)
  }

  return hookFiles
}

// Create a list of hook metadata for each chain
function buildHooksAllowlist(): { [chain in ChainId]: Array<HookMetadata> } {
  // Create ADDRESS_ZERO as a HookMetadata object
  const addressZeroMetadata: HookMetadata = {
    address: ADDRESS_ZERO,
    name: 'No Hook (Regular Pool)',
    keywords: [],
  }

  const allowlist: { [chain in ChainId]: Array<HookMetadata> } = {
    [ChainId.MAINNET]: [addressZeroMetadata],
    [ChainId.GOERLI]: [addressZeroMetadata],
    [ChainId.SEPOLIA]: [addressZeroMetadata],
    [ChainId.OPTIMISM]: [addressZeroMetadata],
    [ChainId.OPTIMISM_GOERLI]: [addressZeroMetadata],
    [ChainId.OPTIMISM_SEPOLIA]: [addressZeroMetadata],
    [ChainId.ARBITRUM_ONE]: [addressZeroMetadata],
    [ChainId.ARBITRUM_GOERLI]: [addressZeroMetadata],
    [ChainId.ARBITRUM_SEPOLIA]: [addressZeroMetadata],
    [ChainId.POLYGON]: [addressZeroMetadata],
    [ChainId.POLYGON_MUMBAI]: [addressZeroMetadata],
    [ChainId.CELO]: [addressZeroMetadata],
    [ChainId.CELO_ALFAJORES]: [addressZeroMetadata],
    [ChainId.GNOSIS]: [addressZeroMetadata],
    [ChainId.MOONBEAM]: [addressZeroMetadata],
    [ChainId.BNB]: [addressZeroMetadata],
    [ChainId.AVALANCHE]: [addressZeroMetadata],
    [ChainId.BASE_GOERLI]: [addressZeroMetadata],
    [ChainId.BASE_SEPOLIA]: [addressZeroMetadata],
    [ChainId.BASE]: [addressZeroMetadata],
    [ChainId.ZORA]: [addressZeroMetadata],
    [ChainId.ZORA_SEPOLIA]: [addressZeroMetadata],
    [ChainId.ROOTSTOCK]: [addressZeroMetadata],
    [ChainId.BLAST]: [addressZeroMetadata],
    [ChainId.ZKSYNC]: [addressZeroMetadata],
    [ChainId.WORLDCHAIN]: [addressZeroMetadata],
    [ChainId.UNICHAIN_SEPOLIA]: [addressZeroMetadata],
    [ChainId.UNICHAIN]: [addressZeroMetadata],
    [ChainId.MONAD_TESTNET]: [addressZeroMetadata],
    [ChainId.SONEIUM]: [addressZeroMetadata],
  }

  const hookFiles = loadAllHookFiles()

  for (const hookFile of hookFiles) {
    for (const [chainIdString, hooks] of Object.entries(hookFile.chains)) {
      const chainId = parseInt(chainIdString) as ChainId

      if (allowlist[chainId]) {
        for (const hook of hooks) {
          const hookAddress = hook.address.toLowerCase()

          // Check if this hook address is already in the allowlist
          const existingHook = allowlist[chainId].find((item) => item.address === hookAddress)

          if (!existingHook) {
            allowlist[chainId].push({
              address: hookAddress,
              name: hook.name,
              keywords: hookFile.keywords || [],
            })
          }
        }
      }
    }
  }

  return allowlist
}

// Create a list of pools for each hook address in V4SubgraphPool format
function buildHookPoolsList(): V4PoolData[] {
  const pools: V4PoolData[] = []

  const hookFiles = loadAllHookFiles()

  for (const hookFile of hookFiles) {
    for (const [, hooks] of Object.entries(hookFile.chains)) {
      for (const hook of hooks) {
        if (hook.pools && hook.pools.length > 0) {
          for (const pool of hook.pools) {
            pools.push({
              id: pool.id.toLowerCase(),
              feeTier: pool.feeTier,
              tickSpacing: pool.tickSpacing,
              hooks: hook.address.toLowerCase(),
              liquidity: pool.liquidity,
              token0: pool.token0 ? {
                symbol: pool.token0.symbol,
                id: pool.token0.id,
                name: pool.token0.name,
                decimals: pool.token0.decimals,
              } : undefined,
              token1: pool.token1 ? {
                symbol: pool.token1.symbol,
                id: pool.token1.id,
                name: pool.token1.name,
                decimals: pool.token1.decimals,
              } : undefined,
              tvlETH: pool.tvlETH,
              tvlUSD: pool.tvlUSD,
            })
          }
        }
      }
    }
  }

  return pools
}

export const HOOKS_ADDRESSES_ALLOWLIST: { [chain in ChainId]: Array<HookMetadata> } = buildHooksAllowlist()
export const HOOK_POOLS_DATA: V4PoolData[] = buildHookPoolsList()
