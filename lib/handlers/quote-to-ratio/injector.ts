import {
  AlphaRouter,
  AlphaRouterConfig,
  ID_TO_CHAIN_ID,
  ISwapToRatio,
  setGlobalLogger,
  setGlobalMetric,
  SwapAndAddConfig,
  V3HeuristicGasModelFactory,
} from '@uniswap/smart-order-router'
import { MetricsLogger } from 'aws-embedded-metrics'
import { APIGatewayProxyEvent, Context } from 'aws-lambda'
import { default as bunyan, default as Logger } from 'bunyan'
import { BigNumber } from 'ethers'
import { ContainerInjected, InjectorSOR, RequestInjected } from '../injector-sor'
import { AWSMetricsLogger } from '../router-entities/aws-metrics-logger'
import { StaticGasPriceProvider } from '../router-entities/static-gas-price-provider'
import { QuoteToRatioQueryParams } from './schema/quote-to-ratio-schema'

export class QuoteToRatioHandlerInjector extends InjectorSOR<
  ISwapToRatio<AlphaRouterConfig, SwapAndAddConfig>,
  QuoteToRatioQueryParams
> {
  public async getRequestInjected(
    containerInjected: ContainerInjected,
    _requestBody: void,
    requestQueryParams: QuoteToRatioQueryParams,
    _event: APIGatewayProxyEvent,
    context: Context,
    log: Logger,
    metricsLogger: MetricsLogger
  ): Promise<RequestInjected<ISwapToRatio<AlphaRouterConfig, SwapAndAddConfig>>> {
    const requestId = context.awsRequestId
    const quoteId = requestId.substring(0, 5)
    const logLevel = bunyan.INFO

    const {
      token0Address,
      token0ChainId,
      token1Address,
      token1ChainId,
      token0Balance,
      token1Balance,
      tickLower,
      tickUpper,
      gasPriceWei,
    } = requestQueryParams

    log = log.child({
      serializers: bunyan.stdSerializers,
      level: logLevel,
      token0Address,
      token0ChainId,
      token1Address,
      token1ChainId,
      token0Balance,
      token1Balance,
      tickLower,
      tickUpper,
    })
    setGlobalLogger(log)

    metricsLogger.setNamespace('Uniswap')
    metricsLogger.setDimensions({ Service: 'RoutingAPI' })
    const metric = new AWSMetricsLogger(metricsLogger)
    setGlobalMetric(metric)

    // Today API is restricted such that both tokens must be on the same chain.
    const chainId = token0ChainId
    const chainIdEnum = ID_TO_CHAIN_ID(chainId)

    const { dependencies } = containerInjected

    if (!dependencies[chainIdEnum]) {
      // Request validation should prevent reject unsupported chains with 4xx already, so this should not be possible.
      throw new Error(`No container injected dependencies for chain: ${chainIdEnum}`)
    }

    const {
      provider,
      v3PoolProvider,
      multicallProvider,
      tokenProvider,
      tokenListProvider,
      v3SubgraphProvider,
      blockedTokenListProvider,
      v3QuoteProvider,
      v2PoolProvider,
      v2QuoteProvider,
      v2SubgraphProvider,
      gasPriceProvider: gasPriceProviderOnChain,
    } = dependencies[chainIdEnum]!

    let gasPriceProvider = gasPriceProviderOnChain
    if (gasPriceWei) {
      const gasPriceWeiBN = BigNumber.from(gasPriceWei)
      gasPriceProvider = new StaticGasPriceProvider(gasPriceWeiBN)
    }

    let router = new AlphaRouter({
      chainId,
      provider,
      v3SubgraphProvider,
      multicall2Provider: multicallProvider,
      v3PoolProvider,
      v3QuoteProvider,
      gasPriceProvider,
      v3GasModelFactory: new V3HeuristicGasModelFactory(),
      blockedTokenListProvider,
      tokenProvider,
      v2PoolProvider,
      v2QuoteProvider,
      v2SubgraphProvider,
    })

    return {
      chainId: chainIdEnum,
      id: quoteId,
      log,
      metric,
      router,
      v3PoolProvider,
      v2PoolProvider,
      tokenProvider,
      tokenListProvider,
    }
  }
}
