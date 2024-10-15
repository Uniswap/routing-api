import { ChainId } from '@uniswap/sdk-core'

export const emptyV4FeeTickSpacingsHookAddresses: Array<[number, number, string]> = new Array<
  [number, number, string]
>()

export const EXTRA_V4_FEE_TICK_SPACINGS_HOOK_ADDRESSES: { [chain in ChainId]: Array<[number, number, string]> } = {
  [ChainId.MAINNET]: emptyV4FeeTickSpacingsHookAddresses,
  [ChainId.GOERLI]: emptyV4FeeTickSpacingsHookAddresses,
  [ChainId.SEPOLIA]: [
    // NOTE, we are only supporting hook routing in sepolia,
    // because those are the only liquid ETH/USDC pools with hardcoded hooks, that we LP'ed against sepolia v4 pool manager
    // we will not support any hook routing in initial v4 launch in any production networks
    [500, 10, '0x0000000000000000000000000000000000000020'],
    [1500, 30, '0x0000000000000000000000000000000000000020'],
    [3000, 60, '0x0000000000000000000000000000000000000020'],
  ],
  [ChainId.OPTIMISM]: emptyV4FeeTickSpacingsHookAddresses,
  [ChainId.OPTIMISM_GOERLI]: emptyV4FeeTickSpacingsHookAddresses,
  [ChainId.OPTIMISM_SEPOLIA]: emptyV4FeeTickSpacingsHookAddresses,
  [ChainId.ARBITRUM_ONE]: emptyV4FeeTickSpacingsHookAddresses,
  [ChainId.ARBITRUM_GOERLI]: emptyV4FeeTickSpacingsHookAddresses,
  [ChainId.ARBITRUM_SEPOLIA]: emptyV4FeeTickSpacingsHookAddresses,
  [ChainId.POLYGON]: emptyV4FeeTickSpacingsHookAddresses,
  [ChainId.POLYGON_MUMBAI]: emptyV4FeeTickSpacingsHookAddresses,
  [ChainId.CELO]: emptyV4FeeTickSpacingsHookAddresses,
  [ChainId.CELO_ALFAJORES]: emptyV4FeeTickSpacingsHookAddresses,
  [ChainId.GNOSIS]: emptyV4FeeTickSpacingsHookAddresses,
  [ChainId.MOONBEAM]: emptyV4FeeTickSpacingsHookAddresses,
  [ChainId.BNB]: emptyV4FeeTickSpacingsHookAddresses,
  [ChainId.AVALANCHE]: emptyV4FeeTickSpacingsHookAddresses,
  [ChainId.BASE_GOERLI]: emptyV4FeeTickSpacingsHookAddresses,
  [ChainId.BASE]: emptyV4FeeTickSpacingsHookAddresses,
  [ChainId.ZORA]: emptyV4FeeTickSpacingsHookAddresses,
  [ChainId.ZORA_SEPOLIA]: emptyV4FeeTickSpacingsHookAddresses,
  [ChainId.ROOTSTOCK]: emptyV4FeeTickSpacingsHookAddresses,
  [ChainId.BLAST]: emptyV4FeeTickSpacingsHookAddresses,
  [ChainId.ZKSYNC]: emptyV4FeeTickSpacingsHookAddresses,
  [ChainId.WORLDCHAIN]: emptyV4FeeTickSpacingsHookAddresses,
  [ChainId.ASTROCHAIN_SEPOLIA]: emptyV4FeeTickSpacingsHookAddresses,
}
