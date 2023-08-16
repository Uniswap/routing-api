import { ProtocolPoolSelection } from '@uniswap/smart-order-router'

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
    maxSwapsPerPath: 1,
    maxSplits: 2,
    distributionPercent: 10
  },
  'patient': {}
}