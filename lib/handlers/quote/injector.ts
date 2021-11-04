import {
  AlphaRouter,
  AlphaRouterConfig,
  HeuristicGasModelFactory,
  ID_TO_CHAIN_ID,
  IRouter,
  LegacyRouter,
  LegacyRoutingConfig,
  setGlobalLogger,
  setGlobalMetric,
} from '@uniswap/smart-order-router'
import { MetricsLogger } from 'aws-embedded-metrics'
import { APIGatewayProxyEvent, Context } from 'aws-lambda'
import { default as bunyan, default as Logger } from 'bunyan'
import { BigNumber } from 'ethers'
import { ContainerInjected, InjectorSOR, RequestInjected } from '../injector-sor'
import { AWSMetricsLogger } from '../router-entities/aws-metrics-logger'
import { StaticGasPriceProvider } from '../router-entities/static-gas-price-provider'
import { QuoteQueryParams } from './schema/quote-schema'

export class QuoteHandlerInjector extends InjectorSOR<
  IRouter<AlphaRouterConfig | LegacyRoutingConfig>,
  QuoteQueryParams
> {
  public async getRequestInjected(
    containerInjected: ContainerInjected,
    _requestBody: void,
    requestQueryParams: QuoteQueryParams,
    _event: APIGatewayProxyEvent,
    context: Context,
    log: Logger,
    metricsLogger: MetricsLogger
  ): Promise<RequestInjected<IRouter<AlphaRouterConfig | LegacyRoutingConfig>>> {
    const requestId = context.awsRequestId
    const quoteId = requestId.substring(0, 5)
    const logLevel = bunyan.INFO

    const { tokenInAddress, tokenInChainId, tokenOutAddress, amount, type, algorithm, gasPriceWei } = requestQueryParams

    log = log.child({
      serializers: bunyan.stdSerializers,
      level: logLevel,
      requestId,
      quoteId,
      tokenInAddress,
      tokenOutAddress,
      amount,
      type,
      algorithm,
    })
    setGlobalLogger(log)

    metricsLogger.setNamespace('Uniswap')
    metricsLogger.setDimensions({ Service: 'RoutingAPI' })
    const metric = new AWSMetricsLogger(metricsLogger)
    setGlobalMetric(metric)

    // Today API is restricted such that both tokens must be on the same chain.
    const chainId = tokenInChainId
    const chainIdEnum = ID_TO_CHAIN_ID(chainId)

    const { dependencies } = containerInjected

    if (!dependencies[chainIdEnum]) {
      // Request validation should prevent reject unsupported chains with 4xx already, so this should not be possible.
      throw new Error(`No container injected dependencies for chain: ${chainIdEnum}`)
    }

    const {
      provider,
      poolProvider,
      multicallProvider,
      tokenProvider,
      tokenListProvider,
      subgraphProvider,
      blockedTokenListProvider,
      quoteProvider,
      gasPriceProvider: gasPriceProviderOnChain,
    } = dependencies[chainIdEnum]!

    let gasPriceProvider = gasPriceProviderOnChain
    if (gasPriceWei) {
      const gasPriceWeiBN = BigNumber.from(gasPriceWei)
      gasPriceProvider = new StaticGasPriceProvider(gasPriceWeiBN, 1)
    }

    let router
    switch (algorithm) {
      case 'legacy':
        router = new LegacyRouter({
          chainId,
          multicall2Provider: multicallProvider,
          poolProvider,
          quoteProvider,
          tokenProvider,
        })
        break
      case 'alpha':
      default:
        router = new AlphaRouter({
          chainId,
          provider,
          subgraphProvider,
          multicall2Provider: multicallProvider,
          poolProvider,
          quoteProvider,
          gasPriceProvider,
          gasModelFactory: new HeuristicGasModelFactory(),
          blockedTokenListProvider,
          tokenProvider,
        })
        break
    }

    return {
      chainId: chainIdEnum,
      id: quoteId,
      log,
      metric,
      router,
      poolProvider,
      tokenProvider,
      tokenListProvider,
    }
  }
}
