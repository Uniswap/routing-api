import { Token } from '@uniswap/sdk-core';
import {
  AlphaRouter,
  CachingGasStationProvider,
  CachingPoolProvider,
  ChainId,
  EIP1559GasPriceProvider,
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
  NodeJSCache,
  PoolProvider,
  QuoteProvider,
  setGlobalLogger,
  setGlobalMetric,
  CachingTokenListProvider,
  TokenProvider,
  CachingTokenProviderWithFallback,
  UniswapMulticallProvider,
} from '@uniswap/smart-order-router';
import { TokenList } from '@uniswap/token-lists';
import { MetricsLogger } from 'aws-embedded-metrics';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { default as bunyan, default as Logger } from 'bunyan';
import { BigNumber, ethers } from 'ethers';
import NodeCache from 'node-cache';
import UNSUPPORTED_TOKEN_LIST from '../../config/unsupported.tokenlist.json';
import { BaseRInj, Injector } from '../handler';
import { AWSMetricsLogger } from './router-entities/aws-metrics-logger';
import { AWSSubgraphProvider } from './router-entities/aws-subgraph-provider';
import { AWSTokenListProvider } from './router-entities/aws-token-list-provider';
import { StaticGasPriceProvider } from './router-entities/static-gas-price-provider';
import { QuoteQueryParams } from './schema/quote-schema';

const SUPPORTED_CHAINS: ChainId[] = [ ChainId.MAINNET, ChainId.RINKEBY ];

const DEFAULT_TOKEN_LIST = 'https://gateway.ipfs.io/ipns/tokens.uniswap.org';

export type ContainerDependencies = {
  provider: ethers.providers.JsonRpcProvider;
  subgraphProvider: ISubgraphProvider;
  tokenListProvider: ITokenListProvider;
  gasPriceProvider: IGasPriceProvider;
  tokenProviderFromTokenList: ITokenProvider;
  blockedTokenListProvider: ITokenListProvider;
  poolProvider: IPoolProvider;
  tokenProvider: ITokenProvider;
  multicallProvider: UniswapMulticallProvider;
  quoteProvider: QuoteProvider;
};

export interface ContainerInjected {
  dependencies: {
    [chainId in ChainId]?: ContainerDependencies;
  } 
}

export interface RequestInjected extends BaseRInj {
  chainId: ChainId;
  metric: IMetric;
  poolProvider: IPoolProvider;
  tokenProvider: ITokenProvider;
  tokenListProvider: ITokenListProvider;
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

    const { dependencies } = containerInjected;

    if (!dependencies[chainIdEnum]) {
      // Request validation should prevent reject unsupported chains with 4xx already, so this should not be possible.
      throw new Error(`No container injected dependencies for chain: ${chainIdEnum}`);
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
      gasPriceProvider: gasPriceProviderOnChain
    } = dependencies[chainIdEnum]!;

    let gasPriceProvider = gasPriceProviderOnChain;
    if (gasPriceWei) {
      const gasPriceWeiBN = BigNumber.from(gasPriceWei);
      gasPriceProvider = new StaticGasPriceProvider(gasPriceWeiBN, 1)
    }

    let router;
    switch (algorithm) {
      case 'legacy':
        router = new LegacyRouter({
          chainId,
          multicall2Provider: multicallProvider,
          poolProvider,
          quoteProvider,
          tokenProvider,
        });
        break;
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
        });
        break;
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

    const dependenciesByChain: { [chainId in ChainId]?: ContainerDependencies } = {};

    for (const chainId of SUPPORTED_CHAINS) {
      const chainName = ID_TO_NETWORK_NAME(chainId);

      const provider = new ethers.providers.JsonRpcProvider(
        {
          url: chainId == ChainId.MAINNET ? process.env.JSON_RPC_URL! : process.env.JSON_RPC_URL_RINKEBY!,
          user: chainId == ChainId.MAINNET ? process.env.JSON_RPC_USERNAME! : process.env.JSON_RPC_USERNAME_RINKEBY!,
          password: chainId == ChainId.MAINNET ? process.env.JSON_RPC_PASSWORD : process.env.JSON_RPC_PASSWORD_RINKEBY,
          timeout: 5000,
        },
        chainName
      );
      
      const tokenListProvider = await AWSTokenListProvider.fromTokenListS3Bucket(
        chainId,
        TOKEN_LIST_CACHE_BUCKET!,
        DEFAULT_TOKEN_LIST
      );
      
      const tokenCache = new NodeJSCache<Token>(new NodeCache({ stdTTL: 3600, useClones: false }));
      const blockedTokenCache = new NodeJSCache<Token>(new NodeCache({ stdTTL: 3600, useClones: false }));

      const multicall2Provider = new UniswapMulticallProvider(chainId, provider, 375_000);
      const tokenProvider = new CachingTokenProviderWithFallback(
        chainId,
        tokenCache,
        tokenListProvider,
        new TokenProvider(chainId, multicall2Provider)
      );

      // Some providers like Infura set a gas limit per call of 10x block gas which is approx 150m
      // 200*725k < 150m
      const quoteProvider = new QuoteProvider(
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
      );

      dependenciesByChain[chainId as ChainId] = {
        provider,
        tokenListProvider: await AWSTokenListProvider.fromTokenListS3Bucket(
          chainId,
          TOKEN_LIST_CACHE_BUCKET!,
          DEFAULT_TOKEN_LIST
        ),
        blockedTokenListProvider: await CachingTokenListProvider.fromTokenList(
          chainId,
          UNSUPPORTED_TOKEN_LIST as TokenList,
          blockedTokenCache
        ),
        multicallProvider: multicall2Provider,
        poolProvider: new CachingPoolProvider(
          chainId,
          new PoolProvider(chainId, multicall2Provider),
          new NodeJSCache(new NodeCache({ stdTTL: 360, useClones: false }))
        ),
        tokenProvider,
        subgraphProvider: new AWSSubgraphProvider(
          chainId,
          POOL_CACHE_BUCKET!,
          POOL_CACHE_KEY!,
        ),
        tokenProviderFromTokenList: tokenListProvider,
        quoteProvider,
        gasPriceProvider: new CachingGasStationProvider(chainId,
          new EIP1559GasPriceProvider(provider),
          new NodeJSCache(new NodeCache({ stdTTL: 15, useClones: false }))
        )
      }
    }

    return {
      dependencies: dependenciesByChain
    };
  }
}
