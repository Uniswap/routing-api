import { ChainId } from '@uniswap/sdk-core'

export interface ChainConfig {
  useMultiProvider: boolean
  allowAutoSwitch?: boolean
  providerInitialWeights?: number[]
  providerUrls?: string[]
}

export type ProdConfig = Map<ChainId, ChainConfig>
