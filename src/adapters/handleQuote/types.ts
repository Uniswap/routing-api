export interface GasStrategy {
  limitInflationFactor: number;
  displayLimitInflationFactor: number;
  priceInflationFactor: number;
  percentileThresholdFor1559Fee: number;
  thresholdToInflateLastBlockBaseFee: number;
  baseFeeMultiplier: number;
  baseFeeHistoryWindow: number;
  minPriorityFeeGwei: number;
  maxPriorityFeeGwei: number;
}

export type QuoteType = 'EXACT_INPUT' | 'EXACT_OUTPUT';

export type UrgencyLevel = 'low' | 'normal' | 'high' | 'urgent';

export type Protocol = 'V3' | 'V2' | 'MIXED';

export type HooksOptions = 'V4_NO_HOOKS' | 'V4_HOOKS';

export interface QuoteRequestBody {
  amount: string;
  generatePermitAsTransaction?: boolean;
  gasStrategies: GasStrategy[];
  swapper?: string;
  tokenIn: string;
  tokenInAddress: string;
  tokenInChainId: number;
  tokenOut: string;
  tokenOutAddress: string;
  tokenOutChainId: number;
  type: QuoteType;
  urgency?: UrgencyLevel;
  protocols?: Protocol[];
  hooksOptions?: HooksOptions;
  slippageTolerance?: number;
}

export interface QuoteQueryParams {
  tokenInAddress: string;
  tokenOutAddress: string;
  tokenInChainId: number;
  tokenOutChainId: number;
  amount: string;
  type: string;
  swapper?: string;
  protocols?: string;
}