import {
  CachingGasStationProvider,
  CachingPoolProvider,
  ChainId,
  EIP1559GasPriceProvider,
  ID_TO_NETWORK_NAME,
  IGasPriceProvider,
  IMetric,
  IPoolProvider,
  ISubgraphProvider,
  ITokenListProvider,
  ITokenProvider,
  NodeJSCache,
  PoolProvider,
  QuoteProvider,
  setGlobalLogger,
  CachingTokenListProvider,
  TokenProvider,
  CachingTokenProviderWithFallback,
  UniswapMulticallProvider,
} from '@uniswap/smart-order-router';
import { BaseRInj, Injector } from './handler';
import {  ethers } from 'ethers';
import { default as bunyan, default as Logger } from 'bunyan';
import { Token } from '@uniswap/sdk-core';
import NodeCache from 'node-cache';
import { AWSTokenListProvider } from './router-entities/aws-token-list-provider';
import { AWSSubgraphProvider } from './router-entities/aws-subgraph-provider';
import { TokenList } from '@uniswap/token-lists';
import UNSUPPORTED_TOKEN_LIST from './../config/unsupported.tokenlist.json';

const SUPPORTED_CHAINS: ChainId[] = [ ChainId.MAINNET, ChainId.RINKEBY ];
const DEFAULT_TOKEN_LIST = 'https://gateway.ipfs.io/ipns/tokens.uniswap.org';

export interface RequestInjected<Router> extends BaseRInj {
  chainId: ChainId;
  metric: IMetric;
  poolProvider: IPoolProvider;
  tokenProvider: ITokenProvider;
  tokenListProvider: ITokenListProvider;
  router: Router;
}

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

export abstract class InjectorSOR<Router, QueryParams> extends Injector<
  ContainerInjected,
  RequestInjected<Router>,
  void,
  QueryParams
> {
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
