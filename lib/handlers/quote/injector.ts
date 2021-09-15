import {
  AlphaRouter,
  CachingGasStationProvider,
  CachingPoolProvider,
  ChainId,
  EIP1559GasPriceProvider,
  HeuristicGasModelFactory,
  ID_TO_CHAIN_ID,
  ID_TO_NETWORK_NAME,
  IMetric,
  IPoolProvider,
  IRouter,
  ISubgraphProvider,
  ITokenListProvider,
  ITokenProvider,
  LegacyRouter,
  PoolProvider,
  QuoteProvider,
  setGlobalLogger,
  setGlobalMetric,
  TokenListProvider,
  TokenProvider,
  TokenProviderWithFallback,
  UniswapMulticallProvider,
} from '@uniswap/smart-order-router';
import { TokenList } from '@uniswap/token-lists';
import { MetricsLogger } from 'aws-embedded-metrics';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { default as bunyan, default as Logger } from 'bunyan';
import { BigNumber, ethers } from 'ethers';
import UNSUPPORTED_TOKEN_LIST from '../../config/unsupported.tokenlist.json';
import { BaseRInj, Injector } from '../handler';
import { AWSMetricsLogger } from './router-entities/aws-metrics-logger';
import { AWSSubgraphProvider } from './router-entities/aws-subgraph-provider';
import { AWSTokenListProvider } from './router-entities/aws-token-list-provider';
import { StaticGasPriceProvider } from './router-entities/static-gas-price-provider';
import { QuoteQueryParams } from './schema/quote-schema';

const DEFAULT_TOKEN_LIST = 'https://gateway.ipfs.io/ipns/tokens.uniswap.org';

export interface ContainerInjected {
  subgraphProvider: ISubgraphProvider;
  subgraphProviderRinkeby: ISubgraphProvider;
  tokenListProvider: ITokenListProvider;
  tokenListProviderRinkeby: ITokenListProvider;
  tokenProviderFromTokenList: ITokenProvider;
  tokenProviderFromTokenListRinkeby: ITokenProvider;
  blockedTokenListProvider: ITokenListProvider;
  blockedTokenListProviderRinkeby: ITokenListProvider;
}

export interface RequestInjected extends BaseRInj {
  metric: IMetric;
  poolProvider: IPoolProvider;
  tokenProvider: ITokenProvider;
  router: IRouter<any>;
}

export class QuoteHandlerInjector extends Injector<
  ContainerInjected,
  RequestInjected,
  void,
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
  ): Promise<RequestInjected> {
    const requestId = context.awsRequestId;
    const quoteId = requestId.substring(0, 5);
    const logLevel = bunyan.INFO;

    const {
      tokenInAddress,
      tokenInChainId,
      tokenOutAddress,
      amount,
      type,
      algorithm,
      gasPriceWei
    } = requestQueryParams;

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
    });
    setGlobalLogger(log);

    metricsLogger.setNamespace('Uniswap');
    metricsLogger.setDimensions({ Service: 'RoutingAPI' });
    const metric = new AWSMetricsLogger(metricsLogger);
    setGlobalMetric(metric);

    // Today API is restricted such that both tokens must be on the same chain.
    const chainId = tokenInChainId;
    const chainIdEnum = ID_TO_CHAIN_ID(chainId);
    const chainName = ID_TO_NETWORK_NAME(chainIdEnum);

    const provider = new ethers.providers.JsonRpcProvider(
      {
        url: chainId == ChainId.MAINNET ? process.env.JSON_RPC_URL! : process.env.JSON_RPC_URL_RINKEBY!,
        user: process.env.JSON_RPC_USERNAME_RINKEBY,
        password: process.env.JSON_RPC_PASSWORD_RINKEBY,
        timeout: 5000,
      },
      chainName
    );

    const multicall2Provider = new UniswapMulticallProvider(chainId, provider, 375_000);
    const poolProvider = new CachingPoolProvider(chainId,
      new PoolProvider(chainIdEnum, multicall2Provider)
    );

    let gasStationProvider;
    if (gasPriceWei) {
      const gasPriceWeiBN = BigNumber.from(gasPriceWei);
      gasStationProvider = new StaticGasPriceProvider(gasPriceWeiBN, 1)
    } else {
      gasStationProvider = new CachingGasStationProvider(chainId,
        new EIP1559GasPriceProvider(provider)
      );
    }

    const {
      subgraphProvider,
      subgraphProviderRinkeby,
      tokenProviderFromTokenList,
      blockedTokenListProvider,
      tokenProviderFromTokenListRinkeby,
      blockedTokenListProviderRinkeby,
    } = containerInjected;

    const subgraphProviderFinal = chainIdEnum == ChainId.MAINNET ? subgraphProvider : subgraphProviderRinkeby;
    const tokenProviderFromTokenListFinal = chainIdEnum == ChainId.MAINNET ? tokenProviderFromTokenList : tokenProviderFromTokenListRinkeby;
    const blockedTokenListProviderRinkebyFinal = chainIdEnum == ChainId.MAINNET ? blockedTokenListProvider : blockedTokenListProviderRinkeby;

    const tokenProvider = new TokenProviderWithFallback(
      chainId,
      tokenProviderFromTokenListFinal,
      new TokenProvider(chainIdEnum, multicall2Provider)
    );

    let router;
    switch (algorithm) {
      case 'legacy':
        router = new LegacyRouter({
          chainId,
          multicall2Provider,
          poolProvider,
          quoteProvider: new QuoteProvider(
            chainId,
            provider,
            multicall2Provider,
            undefined,
            {
              multicallChunk: 150,
              gasLimitPerCall: 1_000_000,
              quoteMinSuccessRate: 0.0,
            }
          ),
          tokenProvider,
        });
        break;
      case 'alpha':
      default:
        router = new AlphaRouter({
          chainId,
          provider,
          subgraphProvider: subgraphProviderFinal,
          multicall2Provider,
          poolProvider,
          // Some providers like Infura set a gas limit per call of 10x block gas which is approx 150m
          // 200*725k < 150m
          quoteProvider: new QuoteProvider(
            chainId,
            provider,
            multicall2Provider,
            {
              retries: 2,
              minTimeout: 100,
              maxTimeout: 1000,
            },
            {
              multicallChunk: 210, // 210
              gasLimitPerCall: 705_000, // 705
              quoteMinSuccessRate: 0.15,
            },
            {
              gasLimitOverride: 2_000_000,
              multicallChunk: 70
            }
          ),
          gasPriceProvider: gasStationProvider,
          gasModelFactory: new HeuristicGasModelFactory(),
          blockedTokenListProvider: blockedTokenListProviderRinkebyFinal,
          tokenProvider,
        });
        break;
    }

    return {
      id: quoteId,
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
      ChainId.MAINNET,
      TOKEN_LIST_CACHE_BUCKET!,
      DEFAULT_TOKEN_LIST
    );

    const tokenListProviderRinkeby = await AWSTokenListProvider.fromTokenListS3Bucket(
      ChainId.RINKEBY,
      TOKEN_LIST_CACHE_BUCKET!,
      DEFAULT_TOKEN_LIST
    );

    const blockedTokenListProvider = await TokenListProvider.fromTokenList(
      ChainId.MAINNET,
      UNSUPPORTED_TOKEN_LIST as TokenList
    );

    const blockedTokenListProviderRinkeby = await TokenListProvider.fromTokenList(
      ChainId.RINKEBY,
      UNSUPPORTED_TOKEN_LIST as TokenList
    );

    return {
      subgraphProvider: new AWSSubgraphProvider(
        ChainId.MAINNET,
        POOL_CACHE_BUCKET!,
        POOL_CACHE_KEY!
      ),
      subgraphProviderRinkeby: new AWSSubgraphProvider(
        ChainId.RINKEBY,
        POOL_CACHE_BUCKET!,
        POOL_CACHE_KEY!
      ),
      tokenListProvider,
      tokenListProviderRinkeby,
      tokenProviderFromTokenList: tokenListProvider,
      tokenProviderFromTokenListRinkeby: tokenListProviderRinkeby,
      blockedTokenListProvider,
      blockedTokenListProviderRinkeby
    };
  }
}
