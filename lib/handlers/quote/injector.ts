import {
  AlphaRouter,
  AlphaRouterConfig,
  ID_TO_CHAIN_ID,
  IRouter,
  LegacyRouter,
  LegacyRoutingConfig,
  setGlobalLogger,
  setGlobalMetric,
  V3HeuristicGasModelFactory,
  V3QuoteProvider,
} from '@uniswap/smart-order-router'
import { MetricsLogger } from 'aws-embedded-metrics'
import { APIGatewayProxyEvent, Context } from 'aws-lambda'
import { default as bunyan, default as Logger } from 'bunyan'
import { BigNumber } from 'ethers'
import { ContainerInjected, InjectorSOR, RequestInjected } from '../injector-sor'
import { AWSMetricsLogger } from '../router-entities/aws-metrics-logger'
import { StaticGasPriceProvider } from '../router-entities/static-gas-price-provider'
import { TenderlyProvider } from '../tenderly-sim/tenderly-sim'
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

    const { tokenInAddress, tokenInChainId, tokenOutAddress, amount, type, algorithm, gasPriceWei, simulate } = requestQueryParams

    log = log.child({
      serializers: bunyan.stdSerializers,
      level: logLevel,
      requestId,
      quoteId,
      tokenInAddress,
      chainId: tokenInChainId,
      tokenOutAddress,
      amount,
      type,
      algorithm,
      tenderlySimulate: simulate,
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
      v3PoolProvider,
      multicallProvider,
      tokenProvider,
      tokenListProvider,
      v3SubgraphProvider,
      blockedTokenListProvider,
      v2PoolProvider,
      v2QuoteProvider,
      v2SubgraphProvider,
      gasPriceProvider: gasPriceProviderOnChain,
    } = dependencies[chainIdEnum]!

    let v3QuoteProvider = dependencies[chainIdEnum]!.v3QuoteProvider
    let gasPriceProvider = gasPriceProviderOnChain
    if (gasPriceWei) {
      const gasPriceWeiBN = BigNumber.from(gasPriceWei)
      gasPriceProvider = new StaticGasPriceProvider(gasPriceWeiBN)
    }

    let router
    switch (algorithm) {
      case 'legacy':
        v3QuoteProvider =
          v3QuoteProvider ??
          new V3QuoteProvider(
            chainId,
            provider,
            multicallProvider,
            {
              retries: 2,
              minTimeout: 100,
              maxTimeout: 1000,
            },
            {
              multicallChunk: 210,
              gasLimitPerCall: 705_000,
              quoteMinSuccessRate: 0.15,
            },
            {
              gasLimitOverride: 2_000_000,
              multicallChunk: 70,
            }
          )
        router = new LegacyRouter({
          chainId,
          multicall2Provider: multicallProvider,
          poolProvider: v3PoolProvider,
          quoteProvider: v3QuoteProvider,
          tokenProvider,
        })
        break
      case 'alpha':
      default:
        router = new AlphaRouter({
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
        break
    }

    let tenderlySimulator: TenderlyProvider|undefined = undefined

    log.info({params:requestQueryParams},"SHOULD SIMULATE?")
    if(simulate) {
      log.info({simulate:simulate}, "MAKING SIMULATOR")
      tenderlySimulator = new TenderlyProvider(
        process.env.TENDERLY_BASE_URL!,
        process.env.TENDERLY_USER!,
        process.env.TENDERLY_PROJECT!,
        process.env.TENDERLY_ACCESS_KEY!
      )
      log.info({
        sim:tenderlySimulator,
        a:process.env.TENDERLY_BASE_URL!,
        b:process.env.TENDERLY_USER!,
        c:process.env.TENDERLY_PROJECT!,
        d:process.env.TENDERLY_ACCESS_KEY!
      }, "MADE SIMULATOR")
    }

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
      simulationProvider: tenderlySimulator
    }
  }
}
