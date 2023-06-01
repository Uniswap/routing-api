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
