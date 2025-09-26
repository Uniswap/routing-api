import { ChainId, Token } from '@juiceswapxyz/sdk-core'
import { FeeAmount } from '@juiceswapxyz/v3-sdk'

/**
 * Static pool configuration for Citrea Testnet (5115)
 * Hardcoded pools to avoid expensive on-chain discovery.
 */

// Citrea tokens
// Use checksummed addresses
const CITREA_TOKENS = {
  WCBTC: new Token(
    ChainId.CITREA_TESTNET,
    '0x4370e27F7d91D9341bFf232d7Ee8bdfE3a9933a0',
    18,
    'WCBTC',
    'Wrapped cBTC'
  ),

  CUSD: new Token(
    ChainId.CITREA_TESTNET,
    '0x2fFC18aC99D367b70dd922771dF8c2074af4aCE0',
    18,
    'cUSD',
    'cUSD'
  ),

  USDC: new Token(
    ChainId.CITREA_TESTNET,
    '0x36c16eaC6B0Ba6c50f494914ff015fCa95B7835F',
    6,
    'USDC',
    'USDC'
  ),

  NUSD: new Token(
    ChainId.CITREA_TESTNET,
    '0x9B28B690550522608890C3C7e63c0b4A7eBab9AA',
    18,
    'NUSD',
    'Nectra USD'
  ),

  TFC: new Token(
    ChainId.CITREA_TESTNET,
    '0x14ADf6B87096Ef750a956756BA191fc6BE94e473',
    18,
    'TFC',
    'TaprootFreakCoin'
  ),
}

// Static pools
export const CITREA_STATIC_POOLS = [
  {
    token0: CITREA_TOKENS.TFC,
    token1: CITREA_TOKENS.WCBTC,
    fee: FeeAmount.MEDIUM,
    liquidity: '30000000000000000000000',
  },

  {
    token0: CITREA_TOKENS.CUSD,
    token1: CITREA_TOKENS.WCBTC,
    fee: FeeAmount.MEDIUM,
    liquidity: '45000000000000000000000',
  },

  {
    token0: CITREA_TOKENS.USDC,
    token1: CITREA_TOKENS.WCBTC,
    fee: FeeAmount.MEDIUM,
    liquidity: '60000000000000000000000',
  },

  {
    token0: CITREA_TOKENS.WCBTC,
    token1: CITREA_TOKENS.NUSD,
    fee: FeeAmount.MEDIUM,
    liquidity: '36000000000000000000000',
  },
]

export { CITREA_TOKENS }

export function getPoolKey(token0: string, token1: string, fee: number): string {
  const [t0, t1] = token0.toLowerCase() < token1.toLowerCase()
    ? [token0, token1]
    : [token1, token0]
  return `${t0}-${t1}-${fee}`
}

export function getCitreaPoolsForSubgraph() {
  return CITREA_STATIC_POOLS.map(pool => ({
    id: getPoolKey(pool.token0.address, pool.token1.address, pool.fee),
    token0: {
      id: pool.token0.address.toLowerCase(),
      symbol: pool.token0.symbol,
      name: pool.token0.name,
      decimals: pool.token0.decimals.toString(),
    },
    token1: {
      id: pool.token1.address.toLowerCase(),
      symbol: pool.token1.symbol,
      name: pool.token1.name,
      decimals: pool.token1.decimals.toString(),
    },
    feeTier: pool.fee.toString(),
    liquidity: pool.liquidity || '0',
    sqrtPrice: '0', // Will be fetched on-chain
    tick: '0', // Will be fetched on-chain
    totalValueLockedToken0: '0',
    totalValueLockedToken1: '0',
    totalValueLockedETH: '0',
    totalValueLockedUSD: '0',
    txCount: '0',
    volumeUSD: '0',
  }))
}