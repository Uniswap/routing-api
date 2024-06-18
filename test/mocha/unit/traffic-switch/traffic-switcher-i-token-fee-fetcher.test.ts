import sinon, { SinonSpy } from 'sinon'
import { metric } from '@uniswap/smart-order-router/build/main/util/metric'
import { ProviderConfig } from '@uniswap/smart-order-router/build/main/providers/provider'
import { TrafficSwitcherITokenFeeFetcher } from '../../../../lib/util/traffic-switch/traffic-switcher-i-token-fee-fetcher'
import { GraphQLTokenFeeFetcher } from '../../../../lib/graphql/graphql-token-fee-fetcher'
import { OnChainTokenFeeFetcher, TokenFeeMap } from '@uniswap/smart-order-router/build/main/providers/token-fee-fetcher'
import { BigNumber } from 'ethers'
import { expect } from 'chai'
import { MetricLoggerUnit } from '@uniswap/smart-order-router'
import { TrafficSwitcher } from '../../../../lib/util/traffic-switch/traffic-switcher'

describe('TrafficSwitcherITokenFeeFetcher', () => {
  let spy: SinonSpy

  const methodFetchFeesReturnFee100 = async (addresses: string[], _?: ProviderConfig): Promise<TokenFeeMap> => {
    const tokenFeeMap: TokenFeeMap = {}
    addresses.map((address) => {
      tokenFeeMap[address] = {
        buyFeeBps: BigNumber.from(100),
        sellFeeBps: BigNumber.from(100),
      }
    })
    return tokenFeeMap
  }

  const methodFetchFeesReturnFee100AndUndefined = async (
    addresses: string[],
    _?: ProviderConfig
  ): Promise<TokenFeeMap> => {
    const tokenFeeMap: TokenFeeMap = {}
    addresses.map((address) => {
      tokenFeeMap[address] = {
        buyFeeBps: BigNumber.from(100),
        sellFeeBps: undefined,
      }
    })
    return tokenFeeMap
  }

  const methodFetchFeesReturnFee100AndZero = async (addresses: string[], _?: ProviderConfig): Promise<TokenFeeMap> => {
    const tokenFeeMap: TokenFeeMap = {}
    addresses.map((address) => {
      tokenFeeMap[address] = {
        buyFeeBps: BigNumber.from(100),
        sellFeeBps: BigNumber.from(0),
      }
    })
    return tokenFeeMap
  }

  const methodFetchFeesReturnFee200 = async (addresses: string[], _?: ProviderConfig): Promise<TokenFeeMap> => {
    const tokenFeeMap: TokenFeeMap = {}
    addresses.map((address) => {
      tokenFeeMap[address] = {
        buyFeeBps: BigNumber.from(200),
        sellFeeBps: BigNumber.from(200),
      }
    })
    return tokenFeeMap
  }

  const methodFetchFeesReturnEmpty = async (_addresses: string[], _?: ProviderConfig): Promise<TokenFeeMap> => {
    return {}
  }

  const methodFetchFeesReturnFee0 = async (addresses: string[], _?: ProviderConfig): Promise<TokenFeeMap> => {
    const tokenFeeMap: TokenFeeMap = {}
    addresses.map((address) => {
      tokenFeeMap[address] = {
        buyFeeBps: BigNumber.from(0),
        sellFeeBps: BigNumber.from(0),
      }
    })
    return tokenFeeMap
  }

  const methodFetchFeesReturnFeeEmpty = async (addresses: string[], _?: ProviderConfig): Promise<TokenFeeMap> => {
    const tokenFeeMap: TokenFeeMap = {}
    addresses.map((address) => {
      tokenFeeMap[address] = {
        buyFeeBps: undefined,
        sellFeeBps: undefined,
      }
    })
    return tokenFeeMap
  }

  const methodFetchFeesThrowsException = async (
    _addresses: string[],
    _providerConfig?: ProviderConfig
  ): Promise<TokenFeeMap> => {
    throw new Error('Exception!')
  }

  beforeEach(() => {
    spy = sinon.spy(metric, 'putMetric')
  })

  afterEach(() => {
    spy.restore()
  })

  it('switch traffic 100% should get result from targetFeeFetcher', async () => {
    const currentFeeFetcher = sinon.createStubInstance(OnChainTokenFeeFetcher)
    const targetFeeFetcher = sinon.createStubInstance(GraphQLTokenFeeFetcher)
    currentFeeFetcher.fetchFees.callsFake(methodFetchFeesReturnFee100)
    targetFeeFetcher.fetchFees.callsFake(methodFetchFeesReturnFee200)

    const trafficSwitchProvider = new TrafficSwitcherITokenFeeFetcher('Exp1', {
      control: currentFeeFetcher,
      treatment: targetFeeFetcher,
      aliasControl: 'Current',
      aliasTreatment: 'Target',
      customization: {
        pctEnabled: 1.0,
        pctShadowSampling: 0.0,
      },
    })

    const tokenFeeMap = await trafficSwitchProvider.fetchFees(['0x1', '0x2'], undefined)

    for (const address in tokenFeeMap) {
      expect(tokenFeeMap[address]).to.deep.equal({
        buyFeeBps: BigNumber.from(200),
        sellFeeBps: BigNumber.from(200),
      })
    }

    sinon.assert.notCalled(currentFeeFetcher.fetchFees)
    sinon.assert.calledOnce(targetFeeFetcher.fetchFees)
    sinon.assert.calledWith(
      spy,
      TrafficSwitcher.METRIC_NAME_TEMPLATE.replace('{EXP}', 'Exp1')
        .replace('{METHOD}', 'fetchFees')
        .replace('{METRIC}', 'SELECTED_IMPL__Target'),
      1,
      MetricLoggerUnit.Count
    )
  })

  it('switch traffic 0% should get result from currentFeeFetcher', async () => {
    const currentFeeFetcher = sinon.createStubInstance(OnChainTokenFeeFetcher)
    const targetFeeFetcher = sinon.createStubInstance(GraphQLTokenFeeFetcher)
    currentFeeFetcher.fetchFees.callsFake(methodFetchFeesReturnFee100)
    targetFeeFetcher.fetchFees.callsFake(methodFetchFeesReturnFee200)

    const trafficSwitchProvider = new TrafficSwitcherITokenFeeFetcher('Exp1', {
      control: currentFeeFetcher,
      treatment: targetFeeFetcher,
      aliasControl: 'Current',
      aliasTreatment: 'Target',
      customization: {
        pctEnabled: 0.0,
        pctShadowSampling: 0.0,
      },
    })

    const tokenFeeMap = await trafficSwitchProvider.fetchFees(['0x1', '0x2'], undefined)

    for (const address in tokenFeeMap) {
      expect(tokenFeeMap[address]).to.deep.equal({
        buyFeeBps: BigNumber.from(100),
        sellFeeBps: BigNumber.from(100),
      })
    }

    sinon.assert.notCalled(targetFeeFetcher.fetchFees)
    sinon.assert.calledOnce(currentFeeFetcher.fetchFees)
    sinon.assert.calledWith(
      spy,
      TrafficSwitcher.METRIC_NAME_TEMPLATE.replace('{EXP}', 'Exp1')
        .replace('{METHOD}', 'fetchFees')
        .replace('{METRIC}', 'SELECTED_IMPL__Current'),
      1,
      MetricLoggerUnit.Count
    )
  })

  it('sampling traffic 100% should get results from both (Identical), and return Current impl result', async () => {
    const currentFeeFetcher = sinon.createStubInstance(OnChainTokenFeeFetcher)
    const targetFeeFetcher = sinon.createStubInstance(GraphQLTokenFeeFetcher)
    currentFeeFetcher.fetchFees.callsFake(methodFetchFeesReturnFee100)
    targetFeeFetcher.fetchFees.callsFake(methodFetchFeesReturnFee100)

    const trafficSwitchProvider = new TrafficSwitcherITokenFeeFetcher('Exp1', {
      control: currentFeeFetcher,
      treatment: targetFeeFetcher,
      aliasControl: 'Current',
      aliasTreatment: 'Target',
      customization: {
        pctEnabled: 0.0,
        pctShadowSampling: 1.0,
      },
    })

    const tokenFeeMap = await trafficSwitchProvider.fetchFees(['0x1', '0x2'], undefined)

    for (const address in tokenFeeMap) {
      expect(tokenFeeMap[address]).to.deep.equal({
        buyFeeBps: BigNumber.from(100),
        sellFeeBps: BigNumber.from(100),
      })
    }

    sinon.assert.calledOnce(targetFeeFetcher.fetchFees)
    sinon.assert.calledOnce(currentFeeFetcher.fetchFees)
    sinon.assert.calledWith(
      spy,
      TrafficSwitcher.METRIC_NAME_TEMPLATE.replace('{EXP}', 'Exp1')
        .replace('{METHOD}', 'fetchFees')
        .replace('{METRIC}', 'COMPARISON_SAMPLE'),
      1,
      MetricLoggerUnit.Count
    )
    sinon.assert.calledWith(
      spy,
      TrafficSwitcher.METRIC_NAME_TEMPLATE.replace('{EXP}', 'Exp1')
        .replace('{METHOD}', 'fetchFees')
        .replace('{METRIC}', 'COMPARISON__IDENTICAL__RESULT__YES'),
      1,
      MetricLoggerUnit.Count
    )
  })

  it('sampling traffic 100% should get results from both (Different), and return Current impl result', async () => {
    const currentFeeFetcher = sinon.createStubInstance(OnChainTokenFeeFetcher)
    const targetFeeFetcher = sinon.createStubInstance(GraphQLTokenFeeFetcher)
    currentFeeFetcher.fetchFees.callsFake(methodFetchFeesReturnFee100)
    targetFeeFetcher.fetchFees.callsFake(methodFetchFeesReturnFee200)

    const trafficSwitchProvider = new TrafficSwitcherITokenFeeFetcher('Exp1', {
      control: currentFeeFetcher,
      treatment: targetFeeFetcher,
      aliasControl: 'Current',
      aliasTreatment: 'Target',
      customization: {
        pctEnabled: 0.0,
        pctShadowSampling: 1.0,
      },
    })

    const tokenFeeMap = await trafficSwitchProvider.fetchFees(['0x1', '0x2'], undefined)

    for (const address in tokenFeeMap) {
      expect(tokenFeeMap[address]).to.deep.equal({
        buyFeeBps: BigNumber.from(100),
        sellFeeBps: BigNumber.from(100),
      })
    }

    sinon.assert.calledOnce(targetFeeFetcher.fetchFees)
    sinon.assert.calledOnce(currentFeeFetcher.fetchFees)
    sinon.assert.calledWith(
      spy,
      TrafficSwitcher.METRIC_NAME_TEMPLATE.replace('{EXP}', 'Exp1')
        .replace('{METHOD}', 'fetchFees')
        .replace('{METRIC}', 'COMPARISON_SAMPLE'),
      1,
      MetricLoggerUnit.Count
    )
    sinon.assert.calledWith(
      spy,
      TrafficSwitcher.METRIC_NAME_TEMPLATE.replace('{EXP}', 'Exp1')
        .replace('{METHOD}', 'fetchFees')
        .replace('{METRIC}', 'COMPARISON__IDENTICAL__RESULT__NO'),
      1,
      MetricLoggerUnit.Count
    )
    sinon.assert.calledWith(
      spy,
      TrafficSwitcher.METRIC_NAME_TEMPLATE.replace('{EXP}', 'Exp1')
        .replace('{METHOD}', 'fetchFees')
        .replace('{METRIC}', 'COMPARISON__LENGTHS_MATCH__RESULT__YES'),
      1,
      MetricLoggerUnit.Count
    )
    sinon.assert.calledWith(
      spy,
      TrafficSwitcher.METRIC_NAME_TEMPLATE.replace('{EXP}', 'Exp1')
        .replace('{METHOD}', 'fetchFees')
        .replace('{METRIC}', 'DIFFERENT_FEE_FOR__Address__0x1'),
      1,
      MetricLoggerUnit.Count
    )
    sinon.assert.calledWith(
      spy,
      TrafficSwitcher.METRIC_NAME_TEMPLATE.replace('{EXP}', 'Exp1')
        .replace('{METHOD}', 'fetchFees')
        .replace('{METRIC}', 'DIFFERENT_FEE_FOR__Address__0x2'),
      1,
      MetricLoggerUnit.Count
    )
  })

  it('sampling traffic 100% with target impl exception should still return Current impl result', async () => {
    const currentFeeFetcher = sinon.createStubInstance(OnChainTokenFeeFetcher)
    const targetFeeFetcher = sinon.createStubInstance(GraphQLTokenFeeFetcher)
    currentFeeFetcher.fetchFees.callsFake(methodFetchFeesReturnFee100)
    targetFeeFetcher.fetchFees.callsFake(methodFetchFeesThrowsException)

    const trafficSwitchProvider = new TrafficSwitcherITokenFeeFetcher('Exp1', {
      control: currentFeeFetcher,
      treatment: targetFeeFetcher,
      aliasControl: 'Current',
      aliasTreatment: 'Target',
      customization: {
        pctEnabled: 0.0,
        pctShadowSampling: 1.0,
      },
    })

    const tokenFeeMap = await trafficSwitchProvider.fetchFees(['0x1', '0x2'], undefined)

    for (const address in tokenFeeMap) {
      expect(tokenFeeMap[address]).to.deep.equal({
        buyFeeBps: BigNumber.from(100),
        sellFeeBps: BigNumber.from(100),
      })
    }

    sinon.assert.calledOnce(targetFeeFetcher.fetchFees)
    sinon.assert.calledOnce(currentFeeFetcher.fetchFees)
    sinon.assert.calledWith(
      spy,
      TrafficSwitcher.METRIC_NAME_TEMPLATE.replace('{EXP}', 'Exp1')
        .replace('{METHOD}', 'fetchFees')
        .replace('{METRIC}', 'COMPARISON_SAMPLE'),
      1,
      MetricLoggerUnit.Count
    )
    sinon.assert.calledWith(
      spy,
      TrafficSwitcher.METRIC_NAME_TEMPLATE.replace('{EXP}', 'Exp1')
        .replace('{METHOD}', 'fetchFees')
        .replace('{METRIC}', 'Target_EXCEPTION'),
      1,
      MetricLoggerUnit.Count
    )
    sinon.assert.calledWith(
      spy,
      TrafficSwitcher.METRIC_NAME_TEMPLATE.replace('{EXP}', 'Exp1')
        .replace('{METHOD}', 'fetchFees')
        .replace('{METRIC}', 'COMPARISON__Target_IS_UNDEFINED__RESULT__YES'),
      1,
      MetricLoggerUnit.Count
    )
  })

  it('sampling traffic 100% should get results from both (Identical empty/0 fee), and return Current impl result', async () => {
    const currentFeeFetcher = sinon.createStubInstance(OnChainTokenFeeFetcher)
    const targetFeeFetcher = sinon.createStubInstance(GraphQLTokenFeeFetcher)
    currentFeeFetcher.fetchFees.callsFake(methodFetchFeesReturnFee0)
    targetFeeFetcher.fetchFees.callsFake(methodFetchFeesReturnEmpty)

    const trafficSwitchProvider = new TrafficSwitcherITokenFeeFetcher('Exp1', {
      control: currentFeeFetcher,
      treatment: targetFeeFetcher,
      aliasControl: 'Current',
      aliasTreatment: 'Target',
      customization: {
        pctEnabled: 0.0,
        pctShadowSampling: 1.0,
      },
    })

    const tokenFeeMap = await trafficSwitchProvider.fetchFees(['0x1', '0x2'], undefined)

    for (const address in tokenFeeMap) {
      expect(tokenFeeMap[address]).to.deep.equal({
        buyFeeBps: BigNumber.from(0),
        sellFeeBps: BigNumber.from(0),
      })
    }

    sinon.assert.calledOnce(targetFeeFetcher.fetchFees)
    sinon.assert.calledOnce(currentFeeFetcher.fetchFees)
    sinon.assert.calledWith(
      spy,
      TrafficSwitcher.METRIC_NAME_TEMPLATE.replace('{EXP}', 'Exp1')
        .replace('{METHOD}', 'fetchFees')
        .replace('{METRIC}', 'COMPARISON_SAMPLE'),
      1,
      MetricLoggerUnit.Count
    )
    sinon.assert.calledWith(
      spy,
      TrafficSwitcher.METRIC_NAME_TEMPLATE.replace('{EXP}', 'Exp1')
        .replace('{METHOD}', 'fetchFees')
        .replace('{METRIC}', 'COMPARISON__IDENTICAL__RESULT__YES'),
      1,
      MetricLoggerUnit.Count
    )
  })

  it('sampling traffic 100% should get results from both (Identical fee_empty/fee_zero), and return Current impl result', async () => {
    const currentFeeFetcher = sinon.createStubInstance(OnChainTokenFeeFetcher)
    const targetFeeFetcher = sinon.createStubInstance(GraphQLTokenFeeFetcher)
    currentFeeFetcher.fetchFees.callsFake(methodFetchFeesReturnFee0)
    targetFeeFetcher.fetchFees.callsFake(methodFetchFeesReturnFeeEmpty)

    const trafficSwitchProvider = new TrafficSwitcherITokenFeeFetcher('Exp1', {
      control: currentFeeFetcher,
      treatment: targetFeeFetcher,
      aliasControl: 'Current',
      aliasTreatment: 'Target',
      customization: {
        pctEnabled: 0.0,
        pctShadowSampling: 1.0,
      },
    })

    const tokenFeeMap = await trafficSwitchProvider.fetchFees(['0x1', '0x2'], undefined)

    for (const address in tokenFeeMap) {
      expect(tokenFeeMap[address]).to.deep.equal({
        buyFeeBps: BigNumber.from(0),
        sellFeeBps: BigNumber.from(0),
      })
    }

    sinon.assert.calledOnce(targetFeeFetcher.fetchFees)
    sinon.assert.calledOnce(currentFeeFetcher.fetchFees)
    sinon.assert.calledWith(
      spy,
      TrafficSwitcher.METRIC_NAME_TEMPLATE.replace('{EXP}', 'Exp1')
        .replace('{METHOD}', 'fetchFees')
        .replace('{METRIC}', 'COMPARISON_SAMPLE'),
      1,
      MetricLoggerUnit.Count
    )
    sinon.assert.calledWith(
      spy,
      TrafficSwitcher.METRIC_NAME_TEMPLATE.replace('{EXP}', 'Exp1')
        .replace('{METHOD}', 'fetchFees')
        .replace('{METRIC}', 'COMPARISON__IDENTICAL__RESULT__YES'),
      1,
      MetricLoggerUnit.Count
    )
  })

  it('sampling traffic 100% should get results from both (Identical 100+undefined/0 fee), and return Current impl result', async () => {
    const currentFeeFetcher = sinon.createStubInstance(OnChainTokenFeeFetcher)
    const targetFeeFetcher = sinon.createStubInstance(GraphQLTokenFeeFetcher)
    currentFeeFetcher.fetchFees.callsFake(methodFetchFeesReturnFee100AndZero)
    targetFeeFetcher.fetchFees.callsFake(methodFetchFeesReturnFee100AndUndefined)

    const trafficSwitchProvider = new TrafficSwitcherITokenFeeFetcher('Exp1', {
      control: currentFeeFetcher,
      treatment: targetFeeFetcher,
      aliasControl: 'Current',
      aliasTreatment: 'Target',
      customization: {
        pctEnabled: 0.0,
        pctShadowSampling: 1.0,
      },
    })

    const tokenFeeMap = await trafficSwitchProvider.fetchFees(['0x1', '0x2'], undefined)

    for (const address in tokenFeeMap) {
      expect(tokenFeeMap[address]).to.deep.equal({
        buyFeeBps: BigNumber.from(100),
        sellFeeBps: BigNumber.from(0),
      })
    }

    sinon.assert.calledOnce(targetFeeFetcher.fetchFees)
    sinon.assert.calledOnce(currentFeeFetcher.fetchFees)
    sinon.assert.calledWith(
      spy,
      TrafficSwitcher.METRIC_NAME_TEMPLATE.replace('{EXP}', 'Exp1')
        .replace('{METHOD}', 'fetchFees')
        .replace('{METRIC}', 'COMPARISON_SAMPLE'),
      1,
      MetricLoggerUnit.Count
    )
    sinon.assert.calledWith(
      spy,
      TrafficSwitcher.METRIC_NAME_TEMPLATE.replace('{EXP}', 'Exp1')
        .replace('{METHOD}', 'fetchFees')
        .replace('{METRIC}', 'COMPARISON__IDENTICAL__RESULT__YES'),
      1,
      MetricLoggerUnit.Count
    )
  })
})
