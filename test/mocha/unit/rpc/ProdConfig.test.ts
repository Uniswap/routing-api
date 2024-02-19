import { expect } from 'chai'
import { ProdConfig, ProdConfigCodec } from '../../../../lib/rpc/ProdConfig'
import { isLeft } from 'fp-ts/lib/These'
import { PathReporter } from 'io-ts/PathReporter'

describe('ProdConfig', () => {
  it('test generate json string from ProdConfig', () => {
    const prodConfig: ProdConfig = [
      {
        chainId: 1,
        useMultiProvider: false,
      },
      {
        chainId: 43114,
        useMultiProvider: true,
        sessionAllowProviderFallbackWhenUnhealthy: true,
        providerInitialWeights: [-1, -1],
        providerUrls: ['url1', 'url2'],
      },
    ]

    const jsonStr = JSON.stringify(prodConfig)
    console.log(jsonStr)
    expect(jsonStr).equal(
      '[{"chainId":1,"useMultiProvider":false},{"chainId":43114,"useMultiProvider":true,"sessionAllowProviderFallbackWhenUnhealthy":true,"providerInitialWeights":[-1,-1],"providerUrls":["url1","url2"]}]'
    )
  })

  it('test parse json string into ProdConfig with validation, good case', () => {
    const jsonStr =
      '[{"chainId":1,"useMultiProvider":false},{"chainId":43114,"useMultiProvider":true,"sessionAllowProviderFallbackWhenUnhealthy":true,"providerInitialWeights":[-1,-1],"providerUrls":["url1","url2"]}]'
    const object = JSON.parse(jsonStr)
    const decodeResult = ProdConfigCodec.decode(object)
    if (isLeft(decodeResult)) {
      console.log(PathReporter.report(decodeResult))
      throw new Error('Fail to decode or validate json str')
    }
    const prodConfig: ProdConfig = decodeResult.right
    expect(prodConfig.length).equal(2)
    expect(prodConfig[0]).deep.equal({
      chainId: 1,
      useMultiProvider: false,
    })
    expect(prodConfig[1]).deep.equal({
      chainId: 43114,
      useMultiProvider: true,
      sessionAllowProviderFallbackWhenUnhealthy: true,
      providerInitialWeights: [-1, -1],
      providerUrls: ['url1', 'url2'],
    })
  })

  it('test parse json string into ProdConfig with validation, bad cases', () => {
    let jsonStr = '{"yummy": "yummy"}'
    let decodeResult = ProdConfigCodec.decode(JSON.parse(jsonStr))
    expect(isLeft(decodeResult))

    jsonStr = '[{"chainId":1}]'
    decodeResult = ProdConfigCodec.decode(JSON.parse(jsonStr))
    expect(isLeft(decodeResult))
  })
})
