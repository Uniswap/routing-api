import { describe, expect } from '@jest/globals'
import { v4HooksPoolsFiltering } from '../../../../../lib/util/v4HooksPoolsFiltering'
import { V4SubgraphPool } from '@uniswap/smart-order-router'
import { ChainId } from '@uniswap/sdk-core'

describe('v4HooksPoolsFiltering', () => {
  it('flaunch hooks included', () => {
    const flaunchHookAddress = '0x51Bba15255406Cfe7099a42183302640ba7dAFDC'
    const v4Pools: Array<V4SubgraphPool> = [
      {
        id: '0',
        feeTier: '0',
        tickSpacing: '0',
        hooks: flaunchHookAddress,
        liquidity: '0',
        token0: {
          symbol: 'USDC',
          id: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
          name: 'USD Coin',
          decimals: '6',
        },
        token1: {
          symbol: 'ETH',
          id: '0x0000000000000000000000000000000000000000',
          name: 'Ether',
          decimals: '18',
        },
        tvlETH: 0,
        tvlUSD: 0,
      },
    ]

    expect(v4HooksPoolsFiltering(ChainId.BASE, v4Pools)).toEqual(v4Pools)
  })

  it('before swap hooks pool is filtered out', () => {
    const beforeSwapHookAddress = '0x0000000000000000000000000000000000000080'
    const v4Pools: Array<V4SubgraphPool> = [
      {
        id: '0',
        feeTier: '0',
        tickSpacing: '0',
        hooks: '0x0000000000000000000000000000000000000020',
        liquidity: '0',
        token0: {
          symbol: 'USDC',
          id: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
          name: 'USD Coin',
          decimals: '6',
        },
        token1: {
          symbol: 'ETH',
          id: '0x0000000000000000000000000000000000000000',
          name: 'Ether',
          decimals: '18',
        },
        tvlETH: 0,
        tvlUSD: 0,
      },
      {
        id: '1',
        feeTier: '1',
        tickSpacing: '1',
        hooks: beforeSwapHookAddress,
        liquidity: '1',
        token0: {
          symbol: 'USDC',
          id: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
          name: 'USD Coin',
          decimals: '6',
        },
        token1: {
          symbol: 'ETH',
          id: '0x0000000000000000000000000000000000000000',
          name: 'Ether',
          decimals: '18',
        },
        tvlETH: 1,
        tvlUSD: 1,
      },
    ]

    expect(v4HooksPoolsFiltering(1, v4Pools)).toEqual([v4Pools[0]])
  })

  it('after swap hooks pool is filtered out', () => {
    const afterSwapHookAddress = '0x0000000000000000000000000000000000000040'
    const v4Pools: Array<V4SubgraphPool> = [
      {
        id: '0',
        feeTier: '0',
        tickSpacing: '0',
        hooks: '0x0000000000000000000000000000000000000020',
        liquidity: '0',
        token0: {
          symbol: 'USDC',
          id: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
          name: 'USD Coin',
          decimals: '6',
        },
        token1: {
          symbol: 'ETH',
          id: '0x0000000000000000000000000000000000000000',
          name: 'Ether',
          decimals: '18',
        },
        tvlETH: 0,
        tvlUSD: 0,
      },
      {
        id: '1',
        feeTier: '1',
        tickSpacing: '1',
        hooks: afterSwapHookAddress,
        liquidity: '1',
        token0: {
          symbol: 'USDC',
          id: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
          name: 'USD Coin',
          decimals: '6',
        },
        token1: {
          symbol: 'ETH',
          id: '0x0000000000000000000000000000000000000000',
          name: 'Ether',
          decimals: '18',
        },
        tvlETH: 1,
        tvlUSD: 1,
      },
    ]

    expect(v4HooksPoolsFiltering(1, v4Pools)).toEqual([v4Pools[0]])
  })

  it('dynamic fee hooks pool is filtered out', () => {
    const dynamicFee = `8388608`

    const v4Pools: Array<V4SubgraphPool> = [
      {
        id: '0',
        feeTier: '0',
        tickSpacing: '0',
        hooks: '0x0000000000000000000000000000000000000020',
        liquidity: '0',
        token0: {
          symbol: 'USDC',
          id: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
          name: 'USD Coin',
          decimals: '6',
        },
        token1: {
          symbol: 'ETH',
          id: '0x0000000000000000000000000000000000000000',
          name: 'Ether',
          decimals: '18',
        },
        tvlETH: 0,
        tvlUSD: 0,
      },
      {
        id: '0xed57ea6c3322a14a7891120371ff22b5c3f8ce812cf0d740658128c9ba313a16',
        feeTier: dynamicFee,
        tickSpacing: '1',
        hooks: '0x0000000000000000000000000000000000000020',
        liquidity: '1',
        token0: {
          symbol: 'USDC',
          id: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
          name: 'USD Coin',
          decimals: '6',
        },
        token1: {
          symbol: 'ETH',
          id: '0x0000000000000000000000000000000000000000',
          name: 'Ether',
          decimals: '18',
        },
        tvlETH: 1,
        tvlUSD: 1,
      },
    ]

    expect(v4HooksPoolsFiltering(1, v4Pools)).toEqual([v4Pools[0]])
  })

  it('before initialize hooks pool is not filtered out', () => {
    const beforeInitializeHookAddress = '0x0000000000000000000000000000000000002000'
    const v4Pools: Array<V4SubgraphPool> = [
      {
        id: '0',
        feeTier: '0',
        tickSpacing: '0',
        hooks: '0x0000000000000000000000000000000000000020',
        liquidity: '0',
        token0: {
          symbol: 'USDC',
          id: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
          name: 'USD Coin',
          decimals: '6',
        },
        token1: {
          symbol: 'ETH',
          id: '0x0000000000000000000000000000000000000000',
          name: 'Ether',
          decimals: '18',
        },
        tvlETH: 0,
        tvlUSD: 0,
      },
      {
        id: '1',
        feeTier: '1',
        tickSpacing: '1',
        hooks: beforeInitializeHookAddress,
        liquidity: '1',
        token0: {
          symbol: 'USDC',
          id: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
          name: 'USD Coin',
          decimals: '6',
        },
        token1: {
          symbol: 'ETH',
          id: '0x0000000000000000000000000000000000000000',
          name: 'Ether',
          decimals: '18',
        },
        tvlETH: 1,
        tvlUSD: 1,
      },
    ]

    expect(v4HooksPoolsFiltering(1, v4Pools)).toEqual([v4Pools[0], v4Pools[1]])
  })

  it('after initialize hooks pool is not filtered out', () => {
    const afterInitializeHookAddress = '0x0000000000000000000000000000000000001000'
    const v4Pools: Array<V4SubgraphPool> = [
      {
        id: '0',
        feeTier: '0',
        tickSpacing: '0',
        hooks: '0x0000000000000000000000000000000000000020',
        liquidity: '0',
        token0: {
          symbol: 'USDC',
          id: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
          name: 'USD Coin',
          decimals: '6',
        },
        token1: {
          symbol: 'ETH',
          id: '0x0000000000000000000000000000000000000000',
          name: 'Ether',
          decimals: '18',
        },
        tvlETH: 0,
        tvlUSD: 0,
      },
      {
        id: '1',
        feeTier: '1',
        tickSpacing: '1',
        hooks: afterInitializeHookAddress,
        liquidity: '1',
        token0: {
          symbol: 'USDC',
          id: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
          name: 'USD Coin',
          decimals: '6',
        },
        token1: {
          symbol: 'ETH',
          id: '0x0000000000000000000000000000000000000000',
          name: 'Ether',
          decimals: '18',
        },
        tvlETH: 1,
        tvlUSD: 1,
      },
    ]

    expect(v4HooksPoolsFiltering(1, v4Pools)).toEqual([v4Pools[0], v4Pools[1]])
  })

  it('before add liquidity hooks pool is not filtered out', () => {
    const beforeAddLiquidityHookAddress = '0x0000000000000000000000000000000000000800'
    const v4Pools: Array<V4SubgraphPool> = [
      {
        id: '0',
        feeTier: '0',
        tickSpacing: '0',
        hooks: '0x0000000000000000000000000000000000000020',
        liquidity: '0',
        token0: {
          symbol: 'USDC',
          id: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
          name: 'USD Coin',
          decimals: '6',
        },
        token1: {
          symbol: 'ETH',
          id: '0x0000000000000000000000000000000000000000',
          name: 'Ether',
          decimals: '18',
        },
        tvlETH: 0,
        tvlUSD: 0,
      },
      {
        id: '1',
        feeTier: '1',
        tickSpacing: '1',
        hooks: beforeAddLiquidityHookAddress,
        liquidity: '1',
        token0: {
          symbol: 'USDC',
          id: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
          name: 'USD Coin',
          decimals: '6',
        },
        token1: {
          symbol: 'ETH',
          id: '0x0000000000000000000000000000000000000000',
          name: 'Ether',
          decimals: '18',
        },
        tvlETH: 1,
        tvlUSD: 1,
      },
    ]

    expect(v4HooksPoolsFiltering(1, v4Pools)).toEqual([v4Pools[0], v4Pools[1]])
  })

  it('after add liquidity hooks pool is not filtered out', () => {
    const afterAddLiquidityHookAddress = '0x0000000000000000000000000000000000000400'
    const v4Pools: Array<V4SubgraphPool> = [
      {
        id: '0',
        feeTier: '0',
        tickSpacing: '0',
        hooks: '0x0000000000000000000000000000000000000020',
        liquidity: '0',
        token0: {
          symbol: 'USDC',
          id: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
          name: 'USD Coin',
          decimals: '6',
        },
        token1: {
          symbol: 'ETH',
          id: '0x0000000000000000000000000000000000000000',
          name: 'Ether',
          decimals: '18',
        },
        tvlETH: 0,
        tvlUSD: 0,
      },
      {
        id: '1',
        feeTier: '1',
        tickSpacing: '1',
        hooks: afterAddLiquidityHookAddress,
        liquidity: '1',
        token0: {
          symbol: 'USDC',
          id: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
          name: 'USD Coin',
          decimals: '6',
        },
        token1: {
          symbol: 'ETH',
          id: '0x0000000000000000000000000000000000000000',
          name: 'Ether',
          decimals: '18',
        },
        tvlETH: 1,
        tvlUSD: 1,
      },
    ]

    expect(v4HooksPoolsFiltering(1, v4Pools)).toEqual([v4Pools[0], v4Pools[1]])
  })

  it('before remove liquidity hooks pool is not filtered out', () => {
    const beforeRemoveLiquidityHookAddress = '0x0000000000000000000000000000000000000200'
    const v4Pools: Array<V4SubgraphPool> = [
      {
        id: '0',
        feeTier: '0',
        tickSpacing: '0',
        hooks: '0x0000000000000000000000000000000000000020',
        liquidity: '0',
        token0: {
          symbol: 'USDC',
          id: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
          name: 'USD Coin',
          decimals: '6',
        },
        token1: {
          symbol: 'ETH',
          id: '0x0000000000000000000000000000000000000000',
          name: 'Ether',
          decimals: '18',
        },
        tvlETH: 0,
        tvlUSD: 0,
      },
      {
        id: '1',
        feeTier: '1',
        tickSpacing: '1',
        hooks: beforeRemoveLiquidityHookAddress,
        liquidity: '1',
        token0: {
          symbol: 'USDC',
          id: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
          name: 'USD Coin',
          decimals: '6',
        },
        token1: {
          symbol: 'ETH',
          id: '0x0000000000000000000000000000000000000000',
          name: 'Ether',
          decimals: '18',
        },
        tvlETH: 1,
        tvlUSD: 1,
      },
    ]

    expect(v4HooksPoolsFiltering(1, v4Pools)).toEqual([v4Pools[0], v4Pools[1]])
  })

  it('after remove liquidity hooks pool is not filtered out', () => {
    const afterRemoveLiquidityHookAddress = '0x0000000000000000000000000000000000000100'
    const v4Pools: Array<V4SubgraphPool> = [
      {
        id: '0',
        feeTier: '0',
        tickSpacing: '0',
        hooks: '0x0000000000000000000000000000000000000020',
        liquidity: '0',
        token0: {
          symbol: 'USDC',
          id: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
          name: 'USD Coin',
          decimals: '6',
        },
        token1: {
          symbol: 'ETH',
          id: '0x0000000000000000000000000000000000000000',
          name: 'Ether',
          decimals: '18',
        },
        tvlETH: 0,
        tvlUSD: 0,
      },
      {
        id: '1',
        feeTier: '1',
        tickSpacing: '1',
        hooks: afterRemoveLiquidityHookAddress,
        liquidity: '1',
        token0: {
          symbol: 'USDC',
          id: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
          name: 'USD Coin',
          decimals: '6',
        },
        token1: {
          symbol: 'ETH',
          id: '0x0000000000000000000000000000000000000000',
          name: 'Ether',
          decimals: '18',
        },
        tvlETH: 1,
        tvlUSD: 1,
      },
    ]

    expect(v4HooksPoolsFiltering(1, v4Pools)).toEqual([v4Pools[0], v4Pools[1]])
  })

  it('before donate hooks pool is not filtered out', () => {
    const beforeDonateHookAddress = '0x0000000000000000000000000000000000000020'
    const v4Pools: Array<V4SubgraphPool> = [
      {
        id: '0',
        feeTier: '0',
        tickSpacing: '0',
        hooks: '0x0000000000000000000000000000000000000020',
        liquidity: '0',
        token0: {
          symbol: 'USDC',
          id: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
          name: 'USD Coin',
          decimals: '6',
        },
        token1: {
          symbol: 'ETH',
          id: '0x0000000000000000000000000000000000000000',
          name: 'Ether',
          decimals: '18',
        },
        tvlETH: 0,
        tvlUSD: 0,
      },
      {
        id: '1',
        feeTier: '1',
        tickSpacing: '1',
        hooks: beforeDonateHookAddress,
        liquidity: '1',
        token0: {
          symbol: 'USDC',
          id: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
          name: 'USD Coin',
          decimals: '6',
        },
        token1: {
          symbol: 'ETH',
          id: '0x0000000000000000000000000000000000000000',
          name: 'Ether',
          decimals: '18',
        },
        tvlETH: 1,
        tvlUSD: 1,
      },
    ]

    expect(v4HooksPoolsFiltering(1, v4Pools)).toEqual([v4Pools[0], v4Pools[1]])
  })

  it('after donate hooks pool is not filtered out', () => {
    const afterDonateHookAddress = '0x0000000000000000000000000000000000000010'
    const v4Pools: Array<V4SubgraphPool> = [
      {
        id: '0',
        feeTier: '0',
        tickSpacing: '0',
        hooks: '0x0000000000000000000000000000000000000020',
        liquidity: '0',
        token0: {
          symbol: 'USDC',
          id: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
          name: 'USD Coin',
          decimals: '6',
        },
        token1: {
          symbol: 'ETH',
          id: '0x0000000000000000000000000000000000000000',
          name: 'Ether',
          decimals: '18',
        },
        tvlETH: 0,
        tvlUSD: 0,
      },
      {
        id: '1',
        feeTier: '1',
        tickSpacing: '1',
        hooks: afterDonateHookAddress,
        liquidity: '1',
        token0: {
          symbol: 'USDC',
          id: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
          name: 'USD Coin',
          decimals: '6',
        },
        token1: {
          symbol: 'ETH',
          id: '0x0000000000000000000000000000000000000000',
          name: 'Ether',
          decimals: '18',
        },
        tvlETH: 1,
        tvlUSD: 1,
      },
    ]

    expect(v4HooksPoolsFiltering(1, v4Pools)).toEqual([v4Pools[0], v4Pools[1]])
  })

  it('before swap returns delta hooks pool is not filtered out', () => {
    const beforeSwapReturnsDeltaHookAddress = '0x0000000000000000000000000000000000000008'
    const v4Pools: Array<V4SubgraphPool> = [
      {
        id: '0',
        feeTier: '0',
        tickSpacing: '0',
        hooks: '0x0000000000000000000000000000000000000020',
        liquidity: '0',
        token0: {
          symbol: 'USDC',
          id: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
          name: 'USD Coin',
          decimals: '6',
        },
        token1: {
          symbol: 'ETH',
          id: '0x0000000000000000000000000000000000000000',
          name: 'Ether',
          decimals: '18',
        },
        tvlETH: 0,
        tvlUSD: 0,
      },
      {
        id: '1',
        feeTier: '1',
        tickSpacing: '1',
        hooks: beforeSwapReturnsDeltaHookAddress,
        liquidity: '1',
        token0: {
          symbol: 'USDC',
          id: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
          name: 'USD Coin',
          decimals: '6',
        },
        token1: {
          symbol: 'ETH',
          id: '0x0000000000000000000000000000000000000000',
          name: 'Ether',
          decimals: '18',
        },
        tvlETH: 1,
        tvlUSD: 1,
      },
    ]

    expect(v4HooksPoolsFiltering(1, v4Pools)).toEqual([v4Pools[0], v4Pools[1]])
  })

  it('after swap returns delta hooks pool is not filtered out', () => {
    const afterSwapReturnsDeltaHookAddress = '0x0000000000000000000000000000000000000004'
    const v4Pools: Array<V4SubgraphPool> = [
      {
        id: '0',
        feeTier: '0',
        tickSpacing: '0',
        hooks: '0x0000000000000000000000000000000000000020',
        liquidity: '0',
        token0: {
          symbol: 'USDC',
          id: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
          name: 'USD Coin',
          decimals: '6',
        },
        token1: {
          symbol: 'ETH',
          id: '0x0000000000000000000000000000000000000000',
          name: 'Ether',
          decimals: '18',
        },
        tvlETH: 0,
        tvlUSD: 0,
      },
      {
        id: '1',
        feeTier: '1',
        tickSpacing: '1',
        hooks: afterSwapReturnsDeltaHookAddress,
        liquidity: '1',
        token0: {
          symbol: 'USDC',
          id: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
          name: 'USD Coin',
          decimals: '6',
        },
        token1: {
          symbol: 'ETH',
          id: '0x0000000000000000000000000000000000000000',
          name: 'Ether',
          decimals: '18',
        },
        tvlETH: 1,
        tvlUSD: 1,
      },
    ]

    expect(v4HooksPoolsFiltering(1, v4Pools)).toEqual([v4Pools[0], v4Pools[1]])
  })

  it('after add liquidity returns delta hooks pool is not filtered out', () => {
    const afterAddLiquidityReturnsDeltaHookAddress = '0x0000000000000000000000000000000000000002'
    const v4Pools: Array<V4SubgraphPool> = [
      {
        id: '0',
        feeTier: '0',
        tickSpacing: '0',
        hooks: '0x0000000000000000000000000000000000000020',
        liquidity: '0',
        token0: {
          symbol: 'USDC',
          id: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
          name: 'USD Coin',
          decimals: '6',
        },
        token1: {
          symbol: 'ETH',
          id: '0x0000000000000000000000000000000000000000',
          name: 'Ether',
          decimals: '18',
        },
        tvlETH: 0,
        tvlUSD: 0,
      },
      {
        id: '1',
        feeTier: '1',
        tickSpacing: '1',
        hooks: afterAddLiquidityReturnsDeltaHookAddress,
        liquidity: '1',
        token0: {
          symbol: 'USDC',
          id: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
          name: 'USD Coin',
          decimals: '6',
        },
        token1: {
          symbol: 'ETH',
          id: '0x0000000000000000000000000000000000000000',
          name: 'Ether',
          decimals: '18',
        },
        tvlETH: 1,
        tvlUSD: 1,
      },
    ]

    expect(v4HooksPoolsFiltering(1, v4Pools)).toEqual([v4Pools[0], v4Pools[1]])
  })

  it('after remove liquidity returns delta hooks pool is not filtered out', () => {
    const afterRemoveLiquidityReturnsDeltaHookAddress = '0x0000000000000000000000000000000000000001'
    const v4Pools: Array<V4SubgraphPool> = [
      {
        id: '0',
        feeTier: '0',
        tickSpacing: '0',
        hooks: '0x0000000000000000000000000000000000000020',
        liquidity: '0',
        token0: {
          symbol: 'USDC',
          id: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
          name: 'USD Coin',
          decimals: '6',
        },
        token1: {
          symbol: 'ETH',
          id: '0x0000000000000000000000000000000000000000',
          name: 'Ether',
          decimals: '18',
        },
        tvlETH: 0,
        tvlUSD: 0,
      },
      {
        id: '1',
        feeTier: '1',
        tickSpacing: '1',
        hooks: afterRemoveLiquidityReturnsDeltaHookAddress,
        liquidity: '1',
        token0: {
          symbol: 'USDC',
          id: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
          name: 'USD Coin',
          decimals: '6',
        },
        token1: {
          symbol: 'ETH',
          id: '0x0000000000000000000000000000000000000000',
          name: 'Ether',
          decimals: '18',
        },
        tvlETH: 1,
        tvlUSD: 1,
      },
    ]

    expect(v4HooksPoolsFiltering(1, v4Pools)).toEqual([v4Pools[0], v4Pools[1]])
  })

  it('11 hooks pool to retain 10 pools', () => {
    const afterRemoveLiquidityReturnsDeltaHookAddress = '0x0000000000000000000000000000000000000001'
    const v4Pools: Array<V4SubgraphPool> = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'].map((i) => ({
      id: i,
      feeTier: '500',
      tickSpacing: i,
      hooks: afterRemoveLiquidityReturnsDeltaHookAddress,
      liquidity: i,
      token0: {
        symbol: 'USDC',
        id: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
        name: 'USD Coin',
        decimals: '6',
      },
      token1: {
        symbol: 'ETH',
        id: '0x0000000000000000000000000000000000000000',
        name: 'Ether',
        decimals: '18',
      },
      tvlETH: Number(i),
      tvlUSD: Number(i),
    }))

    expect(v4HooksPoolsFiltering(1, v4Pools)).toEqual(v4Pools.slice(1, 11))
  })
})
