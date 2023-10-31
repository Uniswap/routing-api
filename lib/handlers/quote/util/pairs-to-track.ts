import { ChainId, TradeType } from '@uniswap/sdk-core'

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
  [
    ChainId.OPTIMISM,
    new Map([
      [TradeType.EXACT_INPUT, ['WETH/USDC', 'USDC/WETH']],
      [TradeType.EXACT_OUTPUT, ['*/WETH']],
    ]),
  ],
  [
    ChainId.ARBITRUM_ONE,
    new Map([
      [TradeType.EXACT_INPUT, ['WETH/USDC', 'USDC/WETH']],
      [TradeType.EXACT_OUTPUT, ['*/WETH']],
    ]),
  ],
  [
    ChainId.POLYGON,
    new Map([
      [TradeType.EXACT_INPUT, ['WETH/USDC', 'USDC/WETH', 'WMATIC/USDC', 'USDC/WMATIC']],
      [TradeType.EXACT_OUTPUT, ['*/WMATIC']],
    ]),
  ],
  [ChainId.CELO, new Map([[TradeType.EXACT_OUTPUT, ['*/CELO']]])],
])
