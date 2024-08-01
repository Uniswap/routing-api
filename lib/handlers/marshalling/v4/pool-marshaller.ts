import { Pool } from '@uniswap/v4-sdk'
import { FeeAmount } from '@uniswap/v3-sdk/dist/constants'
import { MarshalledToken, TokenMarshaller } from '../token-marshaller'
import { Protocol } from '@uniswap/router-sdk'

export interface MarshalledPool {
  protocol: Protocol
  token0: MarshalledToken
  token1: MarshalledToken
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
      // TODO: ROUTE-217 - Support native currency routing in V4
      // V4 we should not just wrap
      token0: TokenMarshaller.marshal(pool.token0.wrapped),
      token1: TokenMarshaller.marshal(pool.token1.wrapped),
      fee: pool.fee,
      tickSpacing: pool.tickSpacing,
      hooks: pool.hooks,
      sqrtRatioX96: pool.sqrtRatioX96.toString(),
      liquidity: pool.liquidity.toString(),
      tickCurrent: pool.tickCurrent,
    }
  }

  public static unmarshal(marshalledPool: MarshalledPool): Pool {
    return new Pool(
      TokenMarshaller.unmarshal(marshalledPool.token0),
      TokenMarshaller.unmarshal(marshalledPool.token1),
      marshalledPool.fee,
      marshalledPool.tickSpacing,
      marshalledPool.hooks,
      marshalledPool.sqrtRatioX96,
      marshalledPool.liquidity,
      marshalledPool.tickCurrent
    )
  }
}
