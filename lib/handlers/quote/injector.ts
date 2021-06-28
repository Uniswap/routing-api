import DEFAULT_TOKEN_LIST from '@uniswap/default-token-list';
import {
  AlphaRouter,
  CachingGasStationProvider,
  CachingPoolProvider,
  ETHGasStationInfoProvider,
  HeuristicGasModelFactory,
  ID_TO_CHAIN_ID,
  ID_TO_NETWORK_NAME,
  IMetric,
  IRouter,
  LegacyRouter,
  Multicall2Provider,
  QuoteProvider,
  setGlobalLogger,
  setGlobalMetric,
  TokenProvider,
} from '@uniswap/smart-order-router';
import { MetricsLogger } from 'aws-embedded-metrics';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { default as bunyan, default as Logger } from 'bunyan';
import { ethers } from 'ethers';
import { BaseRInj, Injector } from '../handler';
import { AWSMetricsLogger } from './router-entities/aws-metrics-logger';
import { AWSSubgraphProvider } from './router-entities/aws-subgraph-provider';
import { QuoteBody } from './schema/quote';

export interface ContainerInjected {
  subgraphProvider: AWSSubgraphProvider;
  gasStationProvider: CachingGasStationProvider;
  tokenProvider: TokenProvider;
}

export interface RequestInjected extends BaseRInj {
  quoteId: string;
  metric: IMetric;
  router: IRouter<any>;
}

export class QuoteHandlerInjector extends Injector<
  ContainerInjected,
  RequestInjected,
  QuoteBody
> {
  public async getRequestInjected(
    containerInjected: ContainerInjected,
    request: QuoteBody,
    _event: APIGatewayProxyEvent,
    context: Context,
    log: Logger,
    metricsLogger: MetricsLogger
  ): Promise<RequestInjected> {
    const requestId = context.awsRequestId;
    const quoteId = requestId.substring(0, 5);
    const logLevel = bunyan.INFO;

    const { tokenIn, tokenOut, chainId, amount, type, algorithm } = request;
    log = log.child({
      serializers: bunyan.stdSerializers,
      level: logLevel,
      requestId,
      quoteId,
      tokenIn,
      tokenOut,
      chainId,
      amount,
      type,
      algorithm,
    });
    setGlobalLogger(log);

    metricsLogger.setNamespace('Uniswap');
    metricsLogger.setDimensions({ Service: 'RoutingAPI' });
    const metric = new AWSMetricsLogger(metricsLogger);
    setGlobalMetric(metric);

    const chainIdEnum = ID_TO_CHAIN_ID(chainId);
    const chainName = ID_TO_NETWORK_NAME(chainIdEnum);

    const provider = new ethers.providers.JsonRpcProvider(
      {
        url: process.env.JSON_RPC_URL!,
        user: process.env.JSON_RPC_USERNAME,
        password: process.env.JSON_RPC_PASSWORD,
      },
      chainName
    );

    const multicall2Provider = new Multicall2Provider(provider);

    const { gasStationProvider, subgraphProvider, tokenProvider } =
      containerInjected;
    let router;
    switch (algorithm) {
      case 'legacy':
        log.info({ algorithm }, 'Using Legacy Algorithm');
        router = new LegacyRouter({
          chainId,
          multicall2Provider: new Multicall2Provider(provider),
          poolProvider: new CachingPoolProvider(multicall2Provider),
          quoteProvider: new QuoteProvider(multicall2Provider),
          tokenProvider,
        });
        break;
      case 'alpha':
      default:
        log.info({ algorithm }, 'Using Alpha Algorithm');
        router = new AlphaRouter({
          chainId,
          subgraphProvider,
          multicall2Provider: new Multicall2Provider(provider),
          poolProvider: new CachingPoolProvider(multicall2Provider),
          quoteProvider: new QuoteProvider(multicall2Provider),
          gasPriceProvider: gasStationProvider,
          gasModelFactory: new HeuristicGasModelFactory(),
          tokenProvider,
        });
        break;
    }

    return {
      quoteId,
      log,
      metric,
      router,
    };
  }

  public async buildContainerInjected(): Promise<ContainerInjected> {
    const { POOL_CACHE_BUCKET, POOL_CACHE_KEY } = process.env;
    const tokenProvider = await TokenProvider.fromTokenList(DEFAULT_TOKEN_LIST);

    return {
      gasStationProvider: new CachingGasStationProvider(new ETHGasStationInfoProvider()),
      subgraphProvider: new AWSSubgraphProvider(
        POOL_CACHE_BUCKET!,
        POOL_CACHE_KEY!
      ),
      tokenProvider,
    };
  }
}
