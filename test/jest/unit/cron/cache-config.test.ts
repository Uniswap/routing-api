import { describe, expect, beforeEach, afterEach, it } from '@jest/globals'
import { ChainId } from '@uniswap/sdk-core'
import { v2SubgraphUrlOverride, v3SubgraphUrlOverride, v4SubgraphUrlOverride } from '../../../../lib/cron/cache-config'

describe('cache-config', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('Environment Variables', () => {
    describe('Team ID Environment Variables', () => {
      it('should use default team IDs when environment variables are not set', () => {
        delete process.env.ALCHEMY_TEAM_ID
        delete process.env.ALCHEMY_TEAM_ID_2
        process.env.ALCHEMY_QUERY_KEY = 'test-key'
        process.env.ALCHEMY_QUERY_KEY_2 = 'test-key-2'

        // V2 uses default 'uniswap' team ID
        const v2Url = v2SubgraphUrlOverride(ChainId.MAINNET)
        expect(v2Url).toBe('https://subgraph.satsuma-prod.com/test-key/uniswap/uniswap-v2-mainnet/api')

        // V3 and V4 use default 'uniswap-2' team ID
        const v3Url = v3SubgraphUrlOverride(ChainId.MAINNET)
        expect(v3Url).toBe('https://subgraph.satsuma-prod.com/test-key-2/uniswap-2/uniswap-v3-mainnet/api')

        const v4Url = v4SubgraphUrlOverride(ChainId.MAINNET)
        expect(v4Url).toBe('https://subgraph.satsuma-prod.com/test-key-2/uniswap-2/uniswap-v4-mainnet/api')
      })

      it('should use custom team IDs when environment variables are set', () => {
        process.env.ALCHEMY_TEAM_ID = 'custom-team'
        process.env.ALCHEMY_TEAM_ID_2 = 'custom-team-2'
        process.env.ALCHEMY_QUERY_KEY = 'test-key'
        process.env.ALCHEMY_QUERY_KEY_2 = 'test-key-2'

        // V2 uses ALCHEMY_TEAM_ID
        const v2Url = v2SubgraphUrlOverride(ChainId.MAINNET)
        expect(v2Url).toBe('https://subgraph.satsuma-prod.com/test-key/custom-team/uniswap-v2-mainnet/api')

        // V3 and V4 use ALCHEMY_TEAM_ID_2
        const v3Url = v3SubgraphUrlOverride(ChainId.MAINNET)
        expect(v3Url).toBe('https://subgraph.satsuma-prod.com/test-key-2/custom-team-2/uniswap-v3-mainnet/api')

        const v4Url = v4SubgraphUrlOverride(ChainId.MAINNET)
        expect(v4Url).toBe('https://subgraph.satsuma-prod.com/test-key-2/custom-team-2/uniswap-v4-mainnet/api')
      })
    })

    describe('Query Key Environment Variables', () => {
      it('should handle undefined query keys', () => {
        delete process.env.ALCHEMY_QUERY_KEY
        delete process.env.ALCHEMY_QUERY_KEY_2
        process.env.ALCHEMY_TEAM_ID = 'test-team'
        process.env.ALCHEMY_TEAM_ID_2 = 'test-team-2'

        const v2Url = v2SubgraphUrlOverride(ChainId.MAINNET)
        expect(v2Url).toBe('https://subgraph.satsuma-prod.com/undefined/test-team/uniswap-v2-mainnet/api')

        const v3Url = v3SubgraphUrlOverride(ChainId.MAINNET)
        expect(v3Url).toBe('https://subgraph.satsuma-prod.com/undefined/test-team-2/uniswap-v3-mainnet/api')

        const v4Url = v4SubgraphUrlOverride(ChainId.MAINNET)
        expect(v4Url).toBe('https://subgraph.satsuma-prod.com/undefined/test-team-2/uniswap-v4-mainnet/api')
      })
    })
  })

  describe('v4SubgraphUrlOverride', () => {
    beforeEach(() => {
      process.env.ALCHEMY_QUERY_KEY_2 = 'test-key-2'
      process.env.ALCHEMY_TEAM_ID_2 = 'test-team-2'
    })

    it('should return correct URL for supported chains', () => {
      const testCases = [
        { chainId: ChainId.SEPOLIA, expected: 'uniswap-v4-sepolia-test' },
        { chainId: ChainId.ARBITRUM_ONE, expected: 'uniswap-v4-arbitrum' },
        { chainId: ChainId.BASE, expected: 'uniswap-v4-base' },
        { chainId: ChainId.POLYGON, expected: 'uniswap-v4-polygon' },
        { chainId: ChainId.WORLDCHAIN, expected: 'uniswap-v4-worldchain' },
        { chainId: ChainId.ZORA, expected: 'uniswap-v4-zora' },
        { chainId: ChainId.UNICHAIN, expected: 'uniswap-v4-unichain-mainnet' },
        { chainId: ChainId.BNB, expected: 'uniswap-v4-bsc' },
        { chainId: ChainId.BLAST, expected: 'uniswap-v4-blast' },
        { chainId: ChainId.MAINNET, expected: 'uniswap-v4-mainnet' },
        { chainId: ChainId.SONEIUM, expected: 'uniswap-v4-soneium-mainnet' },
        { chainId: ChainId.OPTIMISM, expected: 'uniswap-v4-optimism' },
      ]

      testCases.forEach(({ chainId, expected }) => {
        const url = v4SubgraphUrlOverride(chainId)
        expect(url).toBe(`https://subgraph.satsuma-prod.com/test-key-2/test-team-2/${expected}/api`)
      })
    })

    it('should return undefined for unsupported chains', () => {
      const url = v4SubgraphUrlOverride(ChainId.GOERLI)
      expect(url).toBeUndefined()
    })
  })

  describe('v3SubgraphUrlOverride', () => {
    beforeEach(() => {
      process.env.ALCHEMY_QUERY_KEY_2 = 'test-key-2'
      process.env.ALCHEMY_TEAM_ID_2 = 'test-team-2'
    })

    it('should return correct URL for supported chains', () => {
      const testCases = [
        { chainId: ChainId.MAINNET, expected: 'uniswap-v3-mainnet' },
        { chainId: ChainId.ARBITRUM_ONE, expected: 'uniswap-v3-arbitrum-ii' },
        { chainId: ChainId.POLYGON, expected: 'uniswap-v3-polygon' },
        { chainId: ChainId.OPTIMISM, expected: 'uniswap-v3-optimism-ii' },
        { chainId: ChainId.AVALANCHE, expected: 'uniswap-v3-avalanche' },
        { chainId: ChainId.BNB, expected: 'uniswap-v3-bsc-ii' },
        { chainId: ChainId.BLAST, expected: 'uniswap-v3-blast' },
        { chainId: ChainId.BASE, expected: 'uniswap-v3-base' },
        { chainId: ChainId.CELO, expected: 'uniswap-v3-celo' },
        { chainId: ChainId.WORLDCHAIN, expected: 'uniswap-v3-worldchain' },
        { chainId: ChainId.UNICHAIN_SEPOLIA, expected: 'uniswap-v3-astrochain-sepolia' },
        { chainId: ChainId.UNICHAIN, expected: 'uniswap-v3-unichain-mainnet' },
        { chainId: ChainId.ZORA, expected: 'uniswap-v3-zora' },
        { chainId: ChainId.SONEIUM, expected: 'uniswap-v3-soneium-mainnet' },
      ]

      testCases.forEach(({ chainId, expected }) => {
        const url = v3SubgraphUrlOverride(chainId)
        expect(url).toBe(`https://subgraph.satsuma-prod.com/test-key-2/test-team-2/${expected}/api`)
      })
    })

    it('should return undefined for unsupported chains', () => {
      const url = v3SubgraphUrlOverride(ChainId.GOERLI)
      expect(url).toBeUndefined()
    })
  })

  describe('v2SubgraphUrlOverride', () => {
    beforeEach(() => {
      process.env.ALCHEMY_QUERY_KEY = 'test-key'
      process.env.ALCHEMY_TEAM_ID = 'test-team'
    })

    it('should return correct URL for supported chains', () => {
      const testCases = [
        { chainId: ChainId.MAINNET, expected: 'uniswap-v2-mainnet' },
        { chainId: ChainId.ARBITRUM_ONE, expected: 'uniswap-v2-arbitrum' },
        { chainId: ChainId.POLYGON, expected: 'uniswap-v2-polygon' },
        { chainId: ChainId.OPTIMISM, expected: 'uniswap-v2-optimism' },
        { chainId: ChainId.AVALANCHE, expected: 'uniswap-v2-avalanche' },
        { chainId: ChainId.BNB, expected: 'uniswap-v2-bsc' },
        { chainId: ChainId.BLAST, expected: 'uniswap-v2-blast' },
        { chainId: ChainId.BASE, expected: 'uniswap-v2-base' },
        { chainId: ChainId.WORLDCHAIN, expected: 'uniswap-v2-worldchain' },
        { chainId: ChainId.UNICHAIN_SEPOLIA, expected: 'uniswap-v2-astrochain-sepolia' },
        { chainId: ChainId.MONAD_TESTNET, expected: 'uniswap-v2-monad-testnet' },
        { chainId: ChainId.UNICHAIN, expected: 'uniswap-v2-unichain-mainnet' },
        { chainId: ChainId.SONEIUM, expected: 'uniswap-v2-soneium-mainnet' },
      ]

      testCases.forEach(({ chainId, expected }) => {
        const url = v2SubgraphUrlOverride(chainId)
        expect(url).toBe(`https://subgraph.satsuma-prod.com/test-key/test-team/${expected}/api`)
      })
    })

    it('should return undefined for unsupported chains', () => {
      const url = v2SubgraphUrlOverride(ChainId.GOERLI)
      expect(url).toBeUndefined()
    })
  })
})