import { expect } from 'chai'
import { ProdConfig, ProdConfigJoi } from '../../../../lib/rpc/ProdConfig'

describe('ProdConfig', () => {
  it('test generate json string from ProdConfig', () => {
    const prodConfig: ProdConfig = [
      {
        chainId: 1,
        useMultiProviderProb: 0,
      },
      {
        chainId: 43114,
        useMultiProviderProb: 1,
        sessionAllowProviderFallbackWhenUnhealthy: true,
        providerInitialWeights: [-1, -1],
        providerUrls: ['url1', 'url2'],
      },
    ]

    const jsonStr = JSON.stringify(prodConfig)
    expect(jsonStr).equal(
      '[{"chainId":1,"useMultiProviderProb":0},{"chainId":43114,"useMultiProviderProb":1,"sessionAllowProviderFallbackWhenUnhealthy":true,"providerInitialWeights":[-1,-1],"providerUrls":["url1","url2"]}]'
    )
  })

  it('test parse json string into ProdConfig with validation, good case', () => {
    const jsonStr =
      '[{"chainId":1,"useMultiProviderProb":0},{"chainId":43114,"useMultiProviderProb":1,"sessionAllowProviderFallbackWhenUnhealthy":true,"providerInitialWeights":[-1,-1],"providerUrls":["url1","url2"],"enableDbSync": true}]'
    const object = JSON.parse(jsonStr)
    const validation = ProdConfigJoi.validate(object)
    if (validation.error) {
      throw new Error(`Fail to decode or validate json str: ${validation.error}`)
    }
    const prodConfig: ProdConfig = validation.value as ProdConfig
    expect(prodConfig.length).equal(2)
    expect(prodConfig[0]).deep.equal({
      chainId: 1,
      useMultiProviderProb: 0,
      dbSyncSampleProb: 1,
      healthCheckSampleProb: 1,
      latencyEvaluationSampleProb: 1,
      enableDbSync: false,
    })
    expect(prodConfig[1]).deep.equal({
      chainId: 43114,
      useMultiProviderProb: 1,
      sessionAllowProviderFallbackWhenUnhealthy: true,
      providerInitialWeights: [-1, -1],
      providerUrls: ['url1', 'url2'],
      dbSyncSampleProb: 1,
      healthCheckSampleProb: 1,
      latencyEvaluationSampleProb: 1,
      enableDbSync: true,
    })
  })

  it('test parse json string into ProdConfig with validation, bad cases', () => {
    let jsonStr = '[{"yummy": "yummy"}]'
    let object = JSON.parse(jsonStr)
    let validation = ProdConfigJoi.validate(object)
    expect(validation.error !== undefined)

    jsonStr =
      '[{"chainId":123,"useMultiProvider":false},{"chainId":43114,"useMultiProvider":true,"sessionAllowProviderFallbackWhenUnhealthy":true,"providerInitialWeights":["x","y"],"providerUrls":["url1","url2"]}]'
    object = JSON.parse(jsonStr)
    validation = ProdConfigJoi.validate(object)
    expect(validation.error !== undefined)

    jsonStr =
      '[{"chainId":123},{"chainId":43114,"useMultiProvider":true,"sessionAllowProviderFallbackWhenUnhealthy":true,"providerInitialWeights":["x","y"],"providerUrls":["url1","url2"]}]'
    object = JSON.parse(jsonStr)
    validation = ProdConfigJoi.validate(object)
    expect(validation.error !== undefined)
  })
})
