import * as t from 'io-ts'
// import { ChainId } from '@uniswap/sdk-core'

export const ProdConfigCodec = t.array(
  t.intersection([
    t.type({
      chainId: t.number,
      useMultiProvider: t.boolean,
    }),
    t.partial({
      sessionAllowProviderFallbackWhenUnhealthy: t.boolean,
      providerInitialWeights: t.array(t.number),
      providerUrls: t.array(t.string),
    }),
  ])
)

export type ProdConfig = t.TypeOf<typeof ProdConfigCodec>

// export interface ChainConfig {
//   useMultiProvider: boolean
//   sessionAllowProviderFallbackWhenUnhealthy?: boolean
//   providerInitialWeights?: number[]
//   providerUrls?: string[]
// }

// export type ProdConfig = Map<ChainId, ChainConfig>
