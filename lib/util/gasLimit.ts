import { BigNumber } from '@ethersproject/bignumber'
import { ChainId } from '@uniswap/sdk-core'

export const ZKSYNC_UPPER_SWAP_GAS_LIMIT = BigNumber.from(6000000)
// CELO high gas limit from SOR https://github.com/Uniswap/smart-order-router/blob/main/src/routers/alpha-router/alpha-router.ts#L670
export const CELO_UPPER_SWAP_GAS_LIMIT = BigNumber.from(5000000)
// https://github.com/Uniswap/routing-api/blob/fe410751985995cb2904837e24f22da7dca1f518/lib/util/onChainQuoteProviderConfigs.ts#L340 divivde by 10
export const WORLDCHAIN_UPPER_SWAP_GAS_LIMIT = BigNumber.from(300000)
// https://github.com/Uniswap/routing-api/blob/fe410751985995cb2904837e24f22da7dca1f518/lib/util/onChainQuoteProviderConfigs.ts#L344 divivde by 10
export const ASTROCHAIN_SEPOLIA_UPPER_SWAP_GAS_LIMIT = BigNumber.from(300000)

export const CHAIN_TO_GAS_LIMIT_MAP: { [chainId: number]: BigNumber } = {
  [ChainId.ZKSYNC]: ZKSYNC_UPPER_SWAP_GAS_LIMIT,
  [ChainId.CELO]: CELO_UPPER_SWAP_GAS_LIMIT,
  [ChainId.CELO_ALFAJORES]: CELO_UPPER_SWAP_GAS_LIMIT,
  [ChainId.ASTROCHAIN_SEPOLIA]: ASTROCHAIN_SEPOLIA_UPPER_SWAP_GAS_LIMIT,
}
