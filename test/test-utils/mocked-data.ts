import { encodeSqrtRatioX96, Pool } from '@uniswap/v3-sdk'
import { FeeAmount } from '../utils/ticks'
import {
  DAI_MAINNET as DAI,
  USDC_MAINNET as USDC,
  USDT_MAINNET as USDT,
  WRAPPED_NATIVE_CURRENCY,
} from '@uniswap/smart-order-router/build/main/index'
import { V3PoolAccessor } from '@uniswap/smart-order-router/build/main/providers/v3/pool-provider'
import _ from 'lodash'
import { ChainId, Currency, Ether, WETH9 } from '@uniswap/sdk-core'
import { DAI_ON, USDC_ON, USDT_ON } from '../utils/tokens'
import { WBTC_MAINNET } from '@uniswap/smart-order-router'

export const USDC_DAI_LOW = new Pool(USDC, DAI, FeeAmount.LOW, encodeSqrtRatioX96(1, 1), 10, 0)
export const USDC_DAI_MEDIUM = new Pool(USDC, DAI, FeeAmount.MEDIUM, encodeSqrtRatioX96(1, 1), 8, 0)
export const USDC_WETH_LOW = new Pool(
  USDC,
  WRAPPED_NATIVE_CURRENCY[1]!,
  FeeAmount.LOW,
  encodeSqrtRatioX96(1, 1),
  500,
  0
)
export const WETH9_USDT_LOW = new Pool(
  WRAPPED_NATIVE_CURRENCY[1]!,
  USDT,
  FeeAmount.LOW,
  encodeSqrtRatioX96(1, 1),
  200,
  0
)
export const DAI_USDT_LOW = new Pool(DAI, USDT, FeeAmount.LOW, encodeSqrtRatioX96(1, 1), 10, 0)
export const SUPPORTED_POOLS: Pool[] = [USDC_DAI_LOW, USDC_DAI_MEDIUM, USDC_WETH_LOW, WETH9_USDT_LOW, DAI_USDT_LOW]

export const buildMockV3PoolAccessor: (pools: Pool[]) => V3PoolAccessor = (pools: Pool[]) => {
  return {
    getAllPools: () => pools,
    getPoolByAddress: (address: string) =>
      _.find(pools, (p) => Pool.getAddress(p.token0, p.token1, p.fee).toLowerCase() == address.toLowerCase()),
    getPool: (tokenA, tokenB, fee) =>
      _.find(pools, (p) => Pool.getAddress(p.token0, p.token1, p.fee) == Pool.getAddress(tokenA, tokenB, fee)),
  }
}

export type Portion = {
  bips: number
  recipient: string
  type: string
}

export const PORTION_BIPS = 12
export const PORTION_RECIPIENT = '0xd8da6bf26964af9d7eed9e03e53415d37aa96045'
export const PORTION_TYPE = 'flat'

export const FLAT_PORTION: Portion = {
  bips: PORTION_BIPS,
  recipient: PORTION_RECIPIENT,
  type: PORTION_TYPE,
}

export const GREENLIST_TOKEN_PAIRS: Array<[Currency, Currency]> = [
  [Ether.onChain(ChainId.MAINNET), USDC_ON(ChainId.MAINNET)],
  [WETH9[ChainId.MAINNET], USDT_ON(ChainId.MAINNET)],
  [DAI_ON(ChainId.MAINNET), WBTC_MAINNET],
]
