import expect from 'expect'
import { computeProtocolsInvolvedIfMixed } from '../../../../../lib/util/computeProtocolsInvolvedIfMixed'
import { CachedRoute, UNI_MAINNET, USDC_MAINNET } from '@uniswap/smart-order-router'
import { MixedRoute } from '@uniswap/smart-order-router'
import { Pool as V3Pool } from '@uniswap/v3-sdk'
import { encodeSqrtRatioX96, FeeAmount } from '@uniswap/v3-sdk'
import { Pool as V4Pool } from '@uniswap/v4-sdk'
import { ADDRESS_ZERO, Protocol } from '@uniswap/router-sdk'
import { WNATIVE_ON } from '../../../../utils/tokens'
import { ChainId } from '@uniswap/sdk-core'
import { V3Route } from '@uniswap/smart-order-router'

const WETH = WNATIVE_ON(ChainId.MAINNET)
const TEST_WETH_USDC_POOL = new V3Pool(
  WETH,
  USDC_MAINNET,
  FeeAmount.HIGH,
  /* sqrtRatio */ '2437312313659959819381354528',
  /* liquidity */ '10272714736694327408',
  /* tickCurrent */ -69633
)

const TEST_UNI_USDC_V4_POOL = new V4Pool(
  USDC_MAINNET,
  UNI_MAINNET,
  FeeAmount.LOW,
  10,
  ADDRESS_ZERO,
  encodeSqrtRatioX96(1, 1),
  500,
  0
)

describe('computeProtocolsInvolvedIfMixed', () => {
  it('mixed route', () => {
    const cachedRoute = new CachedRoute({
      route: new MixedRoute([TEST_UNI_USDC_V4_POOL, TEST_WETH_USDC_POOL], UNI_MAINNET, WETH),
      percent: 100,
    })
    expect(computeProtocolsInvolvedIfMixed(cachedRoute)).toEqual(new Set([Protocol.V3, Protocol.V4]))
  })

  it('v3 route', () => {
    const cachedRoute = new CachedRoute({
      route: new V3Route([TEST_WETH_USDC_POOL], WETH, USDC_MAINNET),
      percent: 100,
    })
    expect(computeProtocolsInvolvedIfMixed(cachedRoute)).toEqual(new Set())
  })
})
