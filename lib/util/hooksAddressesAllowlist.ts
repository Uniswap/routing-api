import { ChainId } from '@uniswap/sdk-core'
import { ADDRESS_ZERO } from '@uniswap/router-sdk'

export const extraHooksAddressesOnSepolia = '0x0000000000000000000000000000000000000020'
export const FLAUNCH_HOOKS_ADDRESS_ON_BASE = '0x51Bba15255406Cfe7099a42183302640ba7dAFDC'
export const ETH_FLETH_AUTO_WRAP_HOOKS_ADDRESS_ON_BASE = '0x9e433f32bb5481a9ca7dff5b3af74a7ed041a888'

// we do not allow v4 pools with non-zero hook address to be routed through in the initial v4 launch.
// this is the ultimate safeguard in the routing subgraph pool cron job.
export const HOOKS_ADDRESSES_ALLOWLIST: { [chain in ChainId]: Array<string> } = {
  [ChainId.MAINNET]: [ADDRESS_ZERO],
  [ChainId.GOERLI]: [ADDRESS_ZERO],
  [ChainId.SEPOLIA]: [ADDRESS_ZERO, extraHooksAddressesOnSepolia],
  [ChainId.OPTIMISM]: [ADDRESS_ZERO],
  [ChainId.OPTIMISM_GOERLI]: [ADDRESS_ZERO],
  [ChainId.OPTIMISM_SEPOLIA]: [ADDRESS_ZERO],
  [ChainId.ARBITRUM_ONE]: [ADDRESS_ZERO],
  [ChainId.ARBITRUM_GOERLI]: [ADDRESS_ZERO],
  [ChainId.ARBITRUM_SEPOLIA]: [ADDRESS_ZERO],
  [ChainId.POLYGON]: [ADDRESS_ZERO],
  [ChainId.POLYGON_MUMBAI]: [ADDRESS_ZERO],
  [ChainId.CELO]: [ADDRESS_ZERO],
  [ChainId.CELO_ALFAJORES]: [ADDRESS_ZERO],
  [ChainId.GNOSIS]: [ADDRESS_ZERO],
  [ChainId.MOONBEAM]: [ADDRESS_ZERO],
  [ChainId.BNB]: [ADDRESS_ZERO],
  [ChainId.AVALANCHE]: [ADDRESS_ZERO],
  [ChainId.BASE_GOERLI]: [ADDRESS_ZERO],
  [ChainId.BASE_SEPOLIA]: [ADDRESS_ZERO],
  [ChainId.BASE]: [ADDRESS_ZERO, FLAUNCH_HOOKS_ADDRESS_ON_BASE, ETH_FLETH_AUTO_WRAP_HOOKS_ADDRESS_ON_BASE],
  [ChainId.ZORA]: [ADDRESS_ZERO],
  [ChainId.ZORA_SEPOLIA]: [ADDRESS_ZERO],
  [ChainId.ROOTSTOCK]: [ADDRESS_ZERO],
  [ChainId.BLAST]: [ADDRESS_ZERO],
  [ChainId.ZKSYNC]: [ADDRESS_ZERO],
  [ChainId.WORLDCHAIN]: [ADDRESS_ZERO],
  [ChainId.UNICHAIN_SEPOLIA]: [ADDRESS_ZERO],
  [ChainId.UNICHAIN]: [ADDRESS_ZERO],
  [ChainId.MONAD_TESTNET]: [ADDRESS_ZERO],
}
