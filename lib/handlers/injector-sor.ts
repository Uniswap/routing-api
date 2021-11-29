import { Token } from '@uniswap/sdk-core'
import {
  CachingGasStationProvider,
  CachingTokenListProvider,
  CachingTokenProviderWithFallback,
  CachingV3PoolProvider,
  ChainId,
  EIP1559GasPriceProvider,
  ID_TO_NETWORK_NAME,
  IGasPriceProvider,
  IMetric,
  ITokenListProvider,
  ITokenProvider,
  IV2SubgraphProvider,
  IV3PoolProvider,
  IV3SubgraphProvider,
  NodeJSCache,
  setGlobalLogger,
  StaticV2SubgraphProvider,
  StaticV3SubgraphProvider,
  TokenProvider,
  UniswapMulticallProvider,
  V2QuoteProvider,
  V3PoolProvider,
  V3QuoteProvider,
} from '@uniswap/smart-order-router'
import { IV2PoolProvider, V2PoolProvider } from '@uniswap/smart-order-router/build/main/src/providers/v2/pool-provider'
import { TokenList } from '@uniswap/token-lists'
import { default as bunyan, default as Logger } from 'bunyan'
import { ethers } from 'ethers'
import _ from 'lodash'
import NodeCache from 'node-cache'
import UNSUPPORTED_TOKEN_LIST from './../config/unsupported.tokenlist.json'
import { BaseRInj, Injector } from './handler'
import { V2AWSSubgraphProvider, V3AWSSubgraphProvider } from './router-entities/aws-subgraph-provider'
import { AWSTokenListProvider } from './router-entities/aws-token-list-provider'

const SUPPORTED_CHAINS: ChainId[] = [ChainId.MAINNET, ChainId.RINKEBY]
const DEFAULT_TOKEN_LIST = 'https://gateway.ipfs.io/ipns/tokens.uniswap.org'

export interface RequestInjected<Router> extends BaseRInj {
  chainId: ChainId
  metric: IMetric
  v3PoolProvider: IV3PoolProvider
  v2PoolProvider: IV2PoolProvider
  tokenProvider: ITokenProvider
  tokenListProvider: ITokenListProvider
  router: Router
}

export type ContainerDependencies = {
  provider: ethers.providers.JsonRpcProvider
  v3SubgraphProvider: IV3SubgraphProvider
  v2SubgraphProvider: IV2SubgraphProvider
  tokenListProvider: ITokenListProvider
  gasPriceProvider: IGasPriceProvider
  tokenProviderFromTokenList: ITokenProvider
  blockedTokenListProvider: ITokenListProvider
  v3PoolProvider: IV3PoolProvider
  v2PoolProvider: IV2PoolProvider
  tokenProvider: ITokenProvider
  multicallProvider: UniswapMulticallProvider
  v3QuoteProvider: V3QuoteProvider
  v2QuoteProvider: V2QuoteProvider
}

export interface ContainerInjected {
  dependencies: {
    [chainId in ChainId]?: ContainerDependencies
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
    })
    setGlobalLogger(log)

    const { POOL_CACHE_BUCKET_2, POOL_CACHE_KEY, TOKEN_LIST_CACHE_BUCKET } = process.env

    const dependenciesByChain: {
      [chainId in ChainId]?: ContainerDependencies
    } = {}

    const dependenciesByChainArray = await Promise.all(
      _.map(SUPPORTED_CHAINS, async (chainId: ChainId) => {
        const chainName = ID_TO_NETWORK_NAME(chainId)

        const provider = new ethers.providers.JsonRpcProvider(
          {
            url: chainId == ChainId.MAINNET ? process.env.JSON_RPC_URL! : process.env.JSON_RPC_URL_RINKEBY!,
            user: chainId == ChainId.MAINNET ? process.env.JSON_RPC_USERNAME! : process.env.JSON_RPC_USERNAME_RINKEBY!,
            password:
              chainId == ChainId.MAINNET ? process.env.JSON_RPC_PASSWORD : process.env.JSON_RPC_PASSWORD_RINKEBY,
            timeout: 5000,
          },
          chainName
        )

        const tokenListProvider = await AWSTokenListProvider.fromTokenListS3Bucket(
          chainId,
          TOKEN_LIST_CACHE_BUCKET!,
          DEFAULT_TOKEN_LIST
        )

        const tokenCache = new NodeJSCache<Token>(new NodeCache({ stdTTL: 3600, useClones: false }))
        const blockedTokenCache = new NodeJSCache<Token>(new NodeCache({ stdTTL: 3600, useClones: false }))

        const multicall2Provider = new UniswapMulticallProvider(chainId, provider, 375_000)
        const tokenProvider = new CachingTokenProviderWithFallback(
          chainId,
          tokenCache,
          tokenListProvider,
          new TokenProvider(chainId, multicall2Provider)
        )

        // Some providers like Infura set a gas limit per call of 10x block gas which is approx 150m
        // 200*725k < 150m
        const quoteProvider = new V3QuoteProvider(
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
            multicallChunk: 70,
          }
        )
        const v3PoolProvider = new CachingV3PoolProvider(
          chainId,
          new V3PoolProvider(chainId, multicall2Provider),
          new NodeJSCache(new NodeCache({ stdTTL: 360, useClones: false }))
        )

        const v2PoolProvider = new V2PoolProvider(chainId, multicall2Provider)

        const [v3SubgraphProvider, v2SubgraphProvider] = await Promise.all([
          (async () => {
            try {
              const subgraphProvider = await V3AWSSubgraphProvider.EagerBuild(
                POOL_CACHE_BUCKET_2!,
                POOL_CACHE_KEY!,
                chainId
              )
              return subgraphProvider
            } catch (err) {
              return new StaticV3SubgraphProvider(chainId, v3PoolProvider)
            }
          })(),
          (async () => {
            try {
              const subgraphProvider = await V2AWSSubgraphProvider.EagerBuild(
                POOL_CACHE_BUCKET_2!,
                POOL_CACHE_KEY!,
                chainId
              )
              return subgraphProvider
            } catch (err) {
              return new StaticV2SubgraphProvider(chainId)
            }
          })(),
        ])

        return {
          chainId,
          dependencies: {
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
            tokenProvider,
            tokenProviderFromTokenList: tokenListProvider,
            gasPriceProvider: new CachingGasStationProvider(
              chainId,
              new EIP1559GasPriceProvider(provider),
              new NodeJSCache(new NodeCache({ stdTTL: 15, useClones: false }))
            ),
            v3SubgraphProvider,
            v3QuoteProvider: quoteProvider,
            v3PoolProvider,
            v2PoolProvider,
            v2QuoteProvider: new V2QuoteProvider(),
            v2SubgraphProvider,
          },
        }
      })
    )

    for (const { chainId, dependencies } of dependenciesByChainArray) {
      dependenciesByChain[chainId] = dependencies
    }

    return {
      dependencies: dependenciesByChain,
    }
  }
}
