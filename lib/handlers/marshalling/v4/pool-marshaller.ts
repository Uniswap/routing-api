import { DYNAMIC_FEE_FLAG, Pool } from '@uniswap/v4-sdk'
import { MarshalledCurrency, TokenMarshaller } from '../token-marshaller'
import { Protocol } from '@uniswap/router-sdk'
import { FeeAmount } from '@uniswap/v3-sdk'
import { isPoolFeeDynamic } from '@uniswap/smart-order-router'
import { Pool as V4Pool } from '@uniswap/v4-sdk'

export interface MarshalledPool {
  protocol: Protocol
  token0: MarshalledCurrency
  token1: MarshalledCurrency
  fee: FeeAmount
  tickSpacing: number
  hooks: string
  sqrtRatioX96: string
  liquidity: string
  tickCurrent: number
}

export class PoolMarshaller {
  public static marshal(pool: Pool): MarshalledPool {
    return {
      protocol: Protocol.V4,
      token0: TokenMarshaller.marshal(pool.token0),
      token1: TokenMarshaller.marshal(pool.token1),
      fee: isPoolFeeDynamic(pool.token0, pool.token1, pool.tickSpacing, pool.hooks, pool.poolId)
        ? DYNAMIC_FEE_FLAG
        : pool.fee,
      tickSpacing: pool.tickSpacing,
      hooks: pool.hooks,
      sqrtRatioX96: pool.sqrtRatioX96.toString(),
      liquidity: pool.liquidity.toString(),
      tickCurrent: pool.tickCurrent,
    }
  }

  public static unmarshal(marshalledPool: MarshalledPool): Pool {
    const token0 = TokenMarshaller.unmarshal(marshalledPool.token0)
    const token1 = TokenMarshaller.unmarshal(marshalledPool.token1)
    const dynamicFeePoolId = V4Pool.getPoolId(
      token0,
      token1,
      DYNAMIC_FEE_FLAG,
      marshalledPool.tickSpacing,
      marshalledPool.hooks
    )

    return new Pool(
      token0,
      token1,
      isPoolFeeDynamic(token0, token1, Number(marshalledPool.tickSpacing), marshalledPool.hooks, dynamicFeePoolId)
        ? DYNAMIC_FEE_FLAG
        : marshalledPool.fee,
      marshalledPool.tickSpacing,
      marshalledPool.hooks,
      marshalledPool.sqrtRatioX96,
      marshalledPool.liquidity,
      marshalledPool.tickCurrent
    )
  }
}
