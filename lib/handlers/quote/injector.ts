import {
  AlphaRouter,
  CachingGasStationProvider,
  CachingPoolProvider,
  ETHGasStationInfoProvider,
  HeuristicGasModelFactory,
  ID_TO_CHAIN_ID,
  ID_TO_NETWORK_NAME,
  IGasPriceProvider,
  IMetric,
  IPoolProvider,
  IRouter,
  ISubgraphProvider,
  ITokenListProvider,
  ITokenProvider,
  LegacyRouter,
  QuoteProvider,
  setGlobalLogger,
  setGlobalMetric,
  TokenProvider,
  UniswapMulticallProvider,
} from '@uniswap/smart-order-router';
import { MetricsLogger } from 'aws-embedded-metrics';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { default as bunyan, default as Logger } from 'bunyan';
import { ethers } from 'ethers';
import { BaseRInj, Injector } from '../handler';
import { AWSMetricsLogger } from './router-entities/aws-metrics-logger';
import { AWSSubgraphProvider } from './router-entities/aws-subgraph-provider';
import { AWSTokenListProvider } from './router-entities/aws-token-list-provider';
import { QuoteBody } from './schema/quote-schema';

const DEFAULT_TOKEN_LIST = 'https://gateway.ipfs.io/ipns/tokens.uniswap.org';
const DEFAULT_BLOCKED_TOKEN_LIST =
  'https://raw.githubusercontent.com/The-Blockchain-Association/sec-notice-list/master/ba-sec-list.json';

export interface ContainerInjected {
  subgraphProvider: ISubgraphProvider;
  gasStationProvider: IGasPriceProvider;
  tokenListProvider: ITokenListProvider;
}

export interface RequestInjected extends BaseRInj {
  quoteId: string;
  metric: IMetric;
  poolProvider: IPoolProvider;
  tokenProvider: ITokenProvider;
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
        timeout: 2500,
      },
      chainName
    );

    const multicall2Provider = new UniswapMulticallProvider(provider);
    const poolProvider = new CachingPoolProvider(multicall2Provider);
    const tokenProvider = new TokenProvider(chainIdEnum, multicall2Provider);

    const { gasStationProvider, subgraphProvider, tokenListProvider } =
      containerInjected;
    let router;
    switch (algorithm) {
      case 'legacy':
        log.info({ algorithm }, 'Using Legacy Algorithm');
        router = new LegacyRouter({
          chainId,
          multicall2Provider: new UniswapMulticallProvider(provider),
          poolProvider,
          quoteProvider: new QuoteProvider(multicall2Provider),
          tokenListProvider,
        });
        break;
      case 'alpha':
      default:
        log.info({ algorithm }, 'Using Alpha Algorithm');
        router = new AlphaRouter({
          chainId,
          subgraphProvider,
          multicall2Provider: new UniswapMulticallProvider(provider),
          poolProvider,
          quoteProvider: new QuoteProvider(multicall2Provider),
          gasPriceProvider: gasStationProvider,
          gasModelFactory: new HeuristicGasModelFactory(),
          tokenListProvider,
          tokenProvider,
        });
        break;
    }

    return {
      quoteId,
      log,
      metric,
      router,
      poolProvider,
      tokenProvider,
    };
  }

  public async buildContainerInjected(): Promise<ContainerInjected> {
    const log: Logger = bunyan.createLogger({
      name: this.injectorName,
      serializers: bunyan.stdSerializers,
      level: bunyan.INFO,
    });
    setGlobalLogger(log);

    const { POOL_CACHE_BUCKET, POOL_CACHE_KEY, TOKEN_LIST_CACHE_BUCKET } =
      process.env;
    const tokenListProvider = await AWSTokenListProvider.fromTokenListS3Bucket(
      TOKEN_LIST_CACHE_BUCKET!,
      DEFAULT_TOKEN_LIST,
      DEFAULT_BLOCKED_TOKEN_LIST
    );

    return {
      gasStationProvider: new CachingGasStationProvider(
        new ETHGasStationInfoProvider()
      ),
      subgraphProvider: new AWSSubgraphProvider(
        POOL_CACHE_BUCKET!,
        POOL_CACHE_KEY!
      ),
      tokenListProvider,
    };
  }
}
