import { BigNumber } from '@ethersproject/bignumber'

export const ZKSYNC_UPPER_SWAP_GAS_LIMIT = BigNumber.from(6000000)
// CELO high gas limit from SOR https://github.com/Uniswap/smart-order-router/blob/main/src/routers/alpha-router/alpha-router.ts#L670
export const CELO_UPPER_SWAP_GAS_LIMIT = BigNumber.from(5000000)
