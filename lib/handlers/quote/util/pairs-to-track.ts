import { TradeType } from '@pollum-io/sdk-core'
import { ChainId } from '@pollum-io/smart-order-router'

export const PAIRS_TO_TRACK: Map<ChainId, Map<TradeType, string[]>> = new Map([
  [ChainId.ROLLUX_TANENBAUM, new Map([[TradeType.EXACT_INPUT, ['WSYS/USDC', 'USDC/WSYS']]])],
])
