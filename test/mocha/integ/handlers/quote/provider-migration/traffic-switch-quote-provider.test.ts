import sinon, { SinonSpy } from 'sinon'
import { metric } from '@uniswap/smart-order-router/build/main/util/metric'
import { MetricLoggerUnit, RouteWithQuotes, USDC_MAINNET, WRAPPED_NATIVE_CURRENCY } from '@uniswap/smart-order-router'
import { TrafficSwitchOnChainQuoteProvider } from '../../../../../../lib/handlers/quote/provider-migration/v3/traffic-switch-on-chain-quote-provider'
import { ChainId, CurrencyAmount } from '@uniswap/sdk-core'
import { V3Route } from '@uniswap/smart-order-router/build/main/routers'
import { USDC_WETH_LOW } from '../../../../../test-utils/mocked-data'
import { getMockedOnChainQuoteProvider } from '../../../../../test-utils/mocked-dependencies'
import { ProviderConfig } from '@uniswap/smart-order-router/build/main/providers/provider'
import { AmountQuote } from '@uniswap/smart-order-router/build/main/providers/on-chain-quote-provider'
import { BigNumber } from 'ethers'

describe('TrafficSwitchOnChainQuoteProvider', () => {
  const amountIns = [CurrencyAmount.fromRawAmount(WRAPPED_NATIVE_CURRENCY[ChainId.MAINNET], '1000000000000000000')]
  const routes = [new V3Route([USDC_WETH_LOW], WRAPPED_NATIVE_CURRENCY[ChainId.MAINNET], USDC_MAINNET)]
  const providerConfig: ProviderConfig = {
    blockNumber: 1001,
  }

  let spy: SinonSpy

  beforeEach(() => {
    spy = sinon.spy(metric, 'putMetric')
  })

  afterEach(() => {
    spy.restore()
  })

  it('switch exact in traffic and sample quotes', async () => {
    spy.withArgs(`ON_CHAIN_QUOTE_PROVIDER_EXACT_IN_TRAFFIC_TOTAL_CHAIN_ID_${ChainId.MAINNET}`, 1, MetricLoggerUnit.None)
    spy.withArgs(
      `ON_CHAIN_QUOTE_PROVIDER_EXACT_IN_TRAFFIC_SAMPLING_CHAIN_ID_${ChainId.MAINNET}`,
      1,
      MetricLoggerUnit.None
    )
    spy.withArgs(
      `ON_CHAIN_QUOTE_PROVIDER_EXACT_IN_TRAFFIC_TARGET_CHAIN_ID_${ChainId.MAINNET}`,
      1,
      MetricLoggerUnit.None
    )

    const currentQuoteProvider = getMockedOnChainQuoteProvider()
    const targetQuoteProvider = getMockedOnChainQuoteProvider()

    const trafficSwitchProvider =
      new (class SwitchTrafficSwitchOnChainQuoteProvider extends TrafficSwitchOnChainQuoteProvider {
        override readonly SHOULD_SWITCH_EXACT_IN_TRAFFIC = (_: ChainId) => true
        override readonly SHOULD_SAMPLE_EXACT_IN_TRAFFIC = (_: ChainId) => true
      })({
        currentQuoteProvider: currentQuoteProvider,
        targetQuoteProvider: targetQuoteProvider,
        chainId: ChainId.MAINNET,
      })

    await trafficSwitchProvider.getQuotesManyExactIn(amountIns, routes, providerConfig)

    sinon.assert.called(spy)
    sinon.assert.calledOnce(currentQuoteProvider.getQuotesManyExactIn)
    sinon.assert.notCalled(targetQuoteProvider.getQuotesManyExactOut)
  })

  it('does not switch exact in traffic and sample quotes', async () => {
    spy.withArgs(`ON_CHAIN_QUOTE_PROVIDER_EXACT_IN_TRAFFIC_TOTAL_CHAIN_ID_${ChainId.MAINNET}`, 1, MetricLoggerUnit.None)
    spy.withArgs(
      `ON_CHAIN_QUOTE_PROVIDER_EXACT_IN_TRAFFIC_CURRENT_CHAIN_ID_${ChainId.MAINNET}`,
      1,
      MetricLoggerUnit.None
    )

    const currentQuoteProvider = getMockedOnChainQuoteProvider()
    const targetQuoteProvider = getMockedOnChainQuoteProvider()

    const trafficSwitchProvider =
      new (class SwitchTrafficSwitchOnChainQuoteProvider extends TrafficSwitchOnChainQuoteProvider {
        override readonly SHOULD_SWITCH_EXACT_IN_TRAFFIC = (_: ChainId) => true
        override readonly SHOULD_SAMPLE_EXACT_IN_TRAFFIC = (_: ChainId) => true
      })({
        currentQuoteProvider: currentQuoteProvider,
        targetQuoteProvider: targetQuoteProvider,
        chainId: ChainId.MAINNET,
      })

    await trafficSwitchProvider.getQuotesManyExactIn(amountIns, routes, providerConfig)

    sinon.assert.called(spy)
    sinon.assert.calledOnce(currentQuoteProvider.getQuotesManyExactIn)
    sinon.assert.notCalled(targetQuoteProvider.getQuotesManyExactOut)
  })

  it('switch exact out traffic and sample quotes', async () => {
    spy.withArgs(
      `ON_CHAIN_QUOTE_PROVIDER_EXACT_OUT_TRAFFIC_TOTAL_CHAIN_ID_${ChainId.MAINNET}`,
      1,
      MetricLoggerUnit.None
    )
    spy.withArgs(
      `ON_CHAIN_QUOTE_PROVIDER_EXACT_OUT_TRAFFIC_SAMPLING_CHAIN_ID_${ChainId.MAINNET}`,
      1,
      MetricLoggerUnit.None
    )
    spy.withArgs(
      `ON_CHAIN_QUOTE_PROVIDER_EXACT_OUT_TRAFFIC_TARGET_CHAIN_ID_${ChainId.MAINNET}`,
      1,
      MetricLoggerUnit.None
    )

    const currentQuoteProvider = getMockedOnChainQuoteProvider()
    const targetQuoteProvider = getMockedOnChainQuoteProvider()

    const trafficSwitchProvider =
      new (class SwitchTrafficSwitchOnChainQuoteProvider extends TrafficSwitchOnChainQuoteProvider {
        override readonly SHOULD_SWITCH_EXACT_OUT_TRAFFIC = (_: ChainId) => true
        override readonly SHOULD_SAMPLE_EXACT_OUT_TRAFFIC = (_: ChainId) => true
      })({
        currentQuoteProvider: currentQuoteProvider,
        targetQuoteProvider: targetQuoteProvider,
        chainId: ChainId.MAINNET,
      })

    await trafficSwitchProvider.getQuotesManyExactOut(amountIns, routes, providerConfig)

    sinon.assert.called(spy)
    sinon.assert.calledOnce(currentQuoteProvider.getQuotesManyExactOut)
    sinon.assert.notCalled(targetQuoteProvider.getQuotesManyExactIn)
  })

  it('does not switch exact out traffic and sample quotes', async () => {
    spy.withArgs(
      `ON_CHAIN_QUOTE_PROVIDER_EXACT_OUT_TRAFFIC_TOTAL_CHAIN_ID_${ChainId.MAINNET}`,
      1,
      MetricLoggerUnit.None
    )
    spy.withArgs(
      `ON_CHAIN_QUOTE_PROVIDER_EXACT_OUT_TRAFFIC_CURRENT_CHAIN_ID_${ChainId.MAINNET}`,
      1,
      MetricLoggerUnit.None
    )

    const currentQuoteProvider = getMockedOnChainQuoteProvider()
    const targetQuoteProvider = getMockedOnChainQuoteProvider()

    const trafficSwitchProvider =
      new (class SwitchTrafficSwitchOnChainQuoteProvider extends TrafficSwitchOnChainQuoteProvider {
        override readonly SHOULD_SWITCH_EXACT_OUT_TRAFFIC = (_: ChainId) => true
        override readonly SHOULD_SAMPLE_EXACT_OUT_TRAFFIC = (_: ChainId) => true
      })({
        currentQuoteProvider: currentQuoteProvider,
        targetQuoteProvider: targetQuoteProvider,
        chainId: ChainId.MAINNET,
      })

    await trafficSwitchProvider.getQuotesManyExactOut(amountIns, routes)

    sinon.assert.called(spy)
    sinon.assert.calledOnce(currentQuoteProvider.getQuotesManyExactOut)
    sinon.assert.notCalled(targetQuoteProvider.getQuotesManyExactIn)
  })

  it('sample exact in quotes and target quoter has runtime error', async () => {
    const currentQuoteProvider = getMockedOnChainQuoteProvider()
    const targetQuoteProvider = getMockedOnChainQuoteProvider()

    targetQuoteProvider.getQuotesManyExactIn.throws()

    const trafficSwitchProvider =
      new (class SwitchTrafficSwitchOnChainQuoteProvider extends TrafficSwitchOnChainQuoteProvider {
        override readonly SHOULD_SAMPLE_EXACT_IN_TRAFFIC = (_: ChainId) => true
      })({
        currentQuoteProvider: currentQuoteProvider,
        targetQuoteProvider: targetQuoteProvider,
        chainId: ChainId.MAINNET,
      })

    await trafficSwitchProvider.getQuotesManyExactIn(amountIns, routes, providerConfig)

    sinon.assert.called(spy)
    // This is the case we will have to invoke currentQuoteProvider.getQuotesManyExactIn twice, because of the runtime error during sampling
    sinon.assert.calledTwice(currentQuoteProvider.getQuotesManyExactIn)
    sinon.assert.threw(targetQuoteProvider.getQuotesManyExactIn)
  })

  it('sample exact out quotes and target quoter has runtime error', async () => {
    const currentQuoteProvider = getMockedOnChainQuoteProvider()
    const targetQuoteProvider = getMockedOnChainQuoteProvider()

    targetQuoteProvider.getQuotesManyExactOut.throws()

    const trafficSwitchProvider =
      new (class SwitchTrafficSwitchOnChainQuoteProvider extends TrafficSwitchOnChainQuoteProvider {
        override readonly SHOULD_SAMPLE_EXACT_OUT_TRAFFIC = (_: ChainId) => true
      })({
        currentQuoteProvider: currentQuoteProvider,
        targetQuoteProvider: targetQuoteProvider,
        chainId: ChainId.MAINNET,
      })

    await trafficSwitchProvider.getQuotesManyExactOut(amountIns, routes, providerConfig)

    sinon.assert.called(spy)
    // This is the case we will have to invoke currentQuoteProvider.getQuotesManyExactIn twice, because of the runtime error during sampling
    sinon.assert.calledTwice(currentQuoteProvider.getQuotesManyExactOut)
    sinon.assert.threw(targetQuoteProvider.getQuotesManyExactOut)
  })

  it('sample exact in quotes and current quoter out of gas for the quote', async () => {
    spy.withArgs(
      `ON_CHAIN_QUOTE_PROVIDER_EXACT_IN_TRAFFIC_CURRENT_AND_TARGET_QUOTES_MATCH_CHAIN_ID_${ChainId.MAINNET}`,
      1,
      MetricLoggerUnit.None
    )
    spy.withArgs(
      `ON_CHAIN_QUOTE_PROVIDER_EXACT_IN_TRAFFIC_CURRENT_AND_TARGET_QUOTES_MISMATCH_CHAIN_ID_${ChainId.MAINNET}`,
      1,
      MetricLoggerUnit.None
    )

    const currentQuoteProvider = getMockedOnChainQuoteProvider()
    const targetQuoteProvider = getMockedOnChainQuoteProvider()
    const quotes: AmountQuote[] = [
      {
        amount: CurrencyAmount.fromRawAmount(WRAPPED_NATIVE_CURRENCY[ChainId.MAINNET], '1000000000000000000'),
        quote: BigNumber.from('1000000000000000000'),
        sqrtPriceX96AfterList: [BigNumber.from(100)],
        initializedTicksCrossedList: [1, 1, 1],
        gasEstimate: BigNumber.from(999999),
        gasLimit: BigNumber.from(1000000),
      },
    ]
    const routesWithQuotes: RouteWithQuotes<V3Route>[] = [
      [new V3Route([USDC_WETH_LOW], WRAPPED_NATIVE_CURRENCY[ChainId.MAINNET], USDC_MAINNET), quotes],
    ]

    currentQuoteProvider.getQuotesManyExactIn.resolves({
      routesWithQuotes: routesWithQuotes,
      blockNumber: BigNumber.from(0),
    })

    const trafficSwitchProvider =
      new (class SwitchTrafficSwitchOnChainQuoteProvider extends TrafficSwitchOnChainQuoteProvider {
        override readonly SHOULD_SAMPLE_EXACT_IN_TRAFFIC = (_: ChainId) => true
      })({
        currentQuoteProvider: currentQuoteProvider,
        targetQuoteProvider: targetQuoteProvider,
        chainId: ChainId.MAINNET,
      })

    await trafficSwitchProvider.getQuotesManyExactIn(amountIns, routes, providerConfig)

    // We will check neither match nor mismatch metric was logged
    sinon.assert.neverCalledWith(
      spy,
      `ON_CHAIN_QUOTE_PROVIDER_EXACT_IN_TRAFFIC_CURRENT_AND_TARGET_QUOTES_MATCH_CHAIN_ID_${ChainId.MAINNET}`,
      1,
      MetricLoggerUnit.None
    )
    sinon.assert.neverCalledWith(
      spy,
      `ON_CHAIN_QUOTE_PROVIDER_EXACT_IN_TRAFFIC_CURRENT_AND_TARGET_QUOTES_MISMATCH_CHAIN_ID_${ChainId.MAINNET}`,
      1,
      MetricLoggerUnit.None
    )
    sinon.assert.calledOnce(currentQuoteProvider.getQuotesManyExactIn)
  })
})
