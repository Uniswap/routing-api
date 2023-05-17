import { TradeType } from '@uniswap/sdk-core'
import { ChainId } from '@uniswap/smart-order-router'

export const PAIRS_TO_TRACK: Map<ChainId, Map<TradeType, string[]>> = new Map([
  [
    ChainId.MAINNET,
    new Map([
      [
        TradeType.EXACT_INPUT,
        ['WETH/USDC', 'USDC/WETH', 'USDT/WETH', 'WETH/USDT', 'WETH/*', 'USDC/*', 'USDT/*', 'DAI/*', 'WBTC/*'],
      ],
      [TradeType.EXACT_OUTPUT, ['USDC/WETH', '*/WETH', '*/USDC', '*/USDT', '*/DAI']],
    ]),
  ],
  [ChainId.OPTIMISM, new Map([[TradeType.EXACT_INPUT, ['WETH/USDC', 'USDC/WETH']]])],
  [ChainId.ARBITRUM_ONE, new Map([[TradeType.EXACT_INPUT, ['WETH/USDC', 'USDC/WETH']]])],
  [ChainId.POLYGON, new Map([[TradeType.EXACT_INPUT, ['WETH/USDC', 'USDC/WETH', 'WMATIC/USDC', 'USDC/WMATIC']]])],
])
