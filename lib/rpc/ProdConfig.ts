import * as t from 'io-ts'

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
