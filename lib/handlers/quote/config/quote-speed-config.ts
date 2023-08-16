import { MapWithLowerCaseKey, ProtocolPoolSelection } from '@uniswap/smart-order-router'

export type QuoteSpeedConfig = {
  v2PoolSelection?: ProtocolPoolSelection;
  v3PoolSelection?: ProtocolPoolSelection;
  maxSwapsPerPath?: number;
  maxSplits?: number;
  distributionPercent?: number;
}

export const QUOTE_SPEED_MAP: { [key: string]: QuoteSpeedConfig } = {
  'standard': {},
  'fast': {
    v2PoolSelection: {
      topN: 1,
      topNDirectSwaps: 1,
      topNTokenInOut: 2,
      topNSecondHop: 0,
      topNWithEachBaseToken: 2,
      topNWithBaseToken: 2,
    },
    v3PoolSelection: {
      topN: 1,
      topNDirectSwaps: 1,
      topNTokenInOut: 2,
      topNSecondHop: 0,
      topNWithEachBaseToken: 2,
      topNWithBaseToken: 2,
    },
    maxSwapsPerPath: 1,
    maxSplits: 2,
    distributionPercent: 10
  },
  'patient': {}
}
