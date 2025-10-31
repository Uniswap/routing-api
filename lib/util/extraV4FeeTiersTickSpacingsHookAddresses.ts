import { ChainId } from '@uniswap/sdk-core'
import { extraHooksAddressesOnSepolia } from './hooksAddressesAllowlist'

export const emptyV4FeeTickSpacingsHookAddresses: Array<[number, number, string]> = new Array<
  [number, number, string]
>()

// this is v4 launch readiness.
// we can't really predict which fee tier + tick spacings v4 pools might get popular, until we launch
// we will have to add in adhoc fashion in routing per chain.
// we cannot search the entire fee tier + tick spacings for v4 pools,
// because it would be too expensive to search all v4 pools on-chain
// There are 10k fee tiers (0 - 100% with increment of 0.01%) and 32766 tick spacings (min 1, max 32767)
// so roughly 32mil v4 pools without hooks
export const EXTRA_V4_FEE_TICK_SPACINGS_HOOK_ADDRESSES: { [chain in ChainId]: Array<[number, number, string]> } = {
  [ChainId.MAINNET]: emptyV4FeeTickSpacingsHookAddresses,
  [ChainId.GOERLI]: emptyV4FeeTickSpacingsHookAddresses,
  [ChainId.SEPOLIA]: [
    // NOTE, we are only supporting hook routing in sepolia,
    // because those are the only liquid ETH/USDC pools with hardcoded hooks, that we LP'ed against sepolia v4 pool manager
    // we will not support any hook routing in initial v4 launch in any production networks
    [500, 10, extraHooksAddressesOnSepolia],
    [1500, 30, extraHooksAddressesOnSepolia],
    [3000, 60, extraHooksAddressesOnSepolia],
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
  [ChainId.BASE_SEPOLIA]: emptyV4FeeTickSpacingsHookAddresses,
  [ChainId.BASE]: emptyV4FeeTickSpacingsHookAddresses,
  [ChainId.ZORA]: emptyV4FeeTickSpacingsHookAddresses,
  [ChainId.ZORA_SEPOLIA]: emptyV4FeeTickSpacingsHookAddresses,
  [ChainId.ROOTSTOCK]: emptyV4FeeTickSpacingsHookAddresses,
  [ChainId.BLAST]: emptyV4FeeTickSpacingsHookAddresses,
  [ChainId.ZKSYNC]: emptyV4FeeTickSpacingsHookAddresses,
  [ChainId.WORLDCHAIN]: emptyV4FeeTickSpacingsHookAddresses,
  [ChainId.UNICHAIN_SEPOLIA]: emptyV4FeeTickSpacingsHookAddresses,
  [ChainId.UNICHAIN]: emptyV4FeeTickSpacingsHookAddresses,
  [ChainId.MONAD_TESTNET]: emptyV4FeeTickSpacingsHookAddresses,
  [ChainId.MONAD]: emptyV4FeeTickSpacingsHookAddresses,
  [ChainId.SONEIUM]: emptyV4FeeTickSpacingsHookAddresses,
}
