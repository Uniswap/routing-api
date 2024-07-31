import { ChainId, Token } from '@uniswap/sdk-core'
import {
  CachingGasStationProvider,
  CachingTokenListProvider,
  CachingTokenProviderWithFallback,
  CachingV2PoolProvider,
  CachingV3PoolProvider,
  EIP1559GasPriceProvider,
  EthEstimateGasSimulator,
  FallbackTenderlySimulator,
  IGasPriceProvider,
  IMetric,
  IOnChainQuoteProvider,
  IRouteCachingProvider,
  ITokenListProvider,
  ITokenPropertiesProvider,
  ITokenProvider,
  IV2PoolProvider,
  IV2SubgraphProvider,
  IV3PoolProvider,
  IV3SubgraphProvider,
  LegacyGasPriceProvider,
  MIXED_ROUTE_QUOTER_V1_ADDRESSES,
  NEW_QUOTER_V2_ADDRESSES,
  NodeJSCache,
  OnChainGasPriceProvider,
  OnChainQuoteProvider,
  QUOTER_V2_ADDRESSES,
  setGlobalLogger,
  Simulator,
  StaticV2SubgraphProvider,
  StaticV3SubgraphProvider,
  TenderlySimulator,
  TokenPropertiesProvider,
  TokenProvider,
  TokenValidatorProvider,
  UniswapMulticallProvider,
  V2PoolProvider,
  V2QuoteProvider,
  V3PoolProvider,
} from '@uniswap/smart-order-router'
import { TokenList } from '@uniswap/token-lists'
import { default as bunyan, default as Logger } from 'bunyan'
import _ from 'lodash'
import NodeCache from 'node-cache'
import UNSUPPORTED_TOKEN_LIST from './../config/unsupported.tokenlist.json'
import { BaseRInj, Injector } from './handler'
import { V2AWSSubgraphProvider, V3AWSSubgraphProvider } from './router-entities/aws-subgraph-provider'
import { AWSTokenListProvider } from './router-entities/aws-token-list-provider'
import { DynamoRouteCachingProvider } from './router-entities/route-caching/dynamo-route-caching-provider'
import { DynamoDBCachingV3PoolProvider } from './pools/pool-caching/v3/dynamo-caching-pool-provider'
import { TrafficSwitchV3PoolProvider } from './pools/provider-migration/v3/traffic-switch-v3-pool-provider'
import { DefaultEVMClient } from './evm/EVMClient'
import { InstrumentedEVMProvider } from './evm/provider/InstrumentedEVMProvider'
import { deriveProviderName } from './evm/provider/ProviderName'
import { V2DynamoCache } from './pools/pool-caching/v2/v2-dynamo-cache'
import { OnChainTokenFeeFetcher } from '@uniswap/smart-order-router/build/main/providers/token-fee-fetcher'
import { PortionProvider } from '@uniswap/smart-order-router/build/main/providers/portion-provider'
import { GlobalRpcProviders } from '../rpc/GlobalRpcProviders'
import { StaticJsonRpcProvider } from '@ethersproject/providers'
import { TrafficSwitchOnChainQuoteProvider } from './quote/provider-migration/v3/traffic-switch-on-chain-quote-provider'
import {
  BLOCK_NUMBER_CONFIGS,
  GAS_ERROR_FAILURE_OVERRIDES,
  NON_OPTIMISTIC_CACHED_ROUTES_BATCH_PARAMS,
  OPTIMISTIC_CACHED_ROUTES_BATCH_PARAMS,
  RETRY_OPTIONS,
  SUCCESS_RATE_FAILURE_OVERRIDES,
} from '../util/onChainQuoteProviderConfigs'
import { v4 } from 'uuid/index'
import { chainProtocols } from '../cron/cache-config'
import { Protocol } from '@uniswap/router-sdk'
import { UniJsonRpcProvider } from '../rpc/UniJsonRpcProvider'
import { GraphQLTokenFeeFetcher } from '../graphql/graphql-token-fee-fetcher'
import { UniGraphQLProvider } from '../graphql/graphql-provider'
import { TrafficSwitcherITokenFeeFetcher } from '../util/traffic-switch/traffic-switcher-i-token-fee-fetcher'

export const SUPPORTED_CHAINS: ChainId[] = [
  ChainId.MAINNET,
  ChainId.OPTIMISM,
  ChainId.ARBITRUM_ONE,
  ChainId.POLYGON,
  ChainId.SEPOLIA,
  ChainId.CELO,
  ChainId.CELO_ALFAJORES,
  ChainId.BNB,
  ChainId.AVALANCHE,
  ChainId.BASE,
  ChainId.BLAST,
  ChainId.ZORA,
  ChainId.ZKSYNC,
]
const DEFAULT_TOKEN_LIST = 'https://gateway.ipfs.io/ipns/tokens.uniswap.org'

export interface RequestInjected<Router> extends BaseRInj {
  chainId: ChainId
  metric: IMetric
  v3PoolProvider: IV3PoolProvider
  v2PoolProvider: IV2PoolProvider
  tokenProvider: ITokenProvider
  tokenListProvider: ITokenListProvider
  router: Router
  quoteSpeed?: string
  intent?: string
}

export type ContainerDependencies = {
  provider: StaticJsonRpcProvider
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
  onChainQuoteProvider?: IOnChainQuoteProvider
  v2QuoteProvider: V2QuoteProvider
  simulator: Simulator
  routeCachingProvider?: IRouteCachingProvider
  tokenValidatorProvider: TokenValidatorProvider
  tokenPropertiesProvider: ITokenPropertiesProvider
  v2Supported: ChainId[]
}

export interface ContainerInjected {
  dependencies: {
    [chainId in ChainId]?: ContainerDependencies
  }
  activityId?: string
}

export abstract class InjectorSOR<Router, QueryParams> extends Injector<
  ContainerInjected,
  RequestInjected<Router>,
  void,
  QueryParams
> {
  public async buildContainerInjected(): Promise<ContainerInjected> {
    const activityId = v4()
    const log: Logger = bunyan.createLogger({
      name: this.injectorName,
      serializers: bunyan.stdSerializers,
      level: bunyan.INFO,
      activityId: activityId,
    })
    setGlobalLogger(log)

    try {
      const {
        POOL_CACHE_BUCKET_3,
        POOL_CACHE_GZIP_KEY,
        TOKEN_LIST_CACHE_BUCKET,
        ROUTES_TABLE_NAME,
        ROUTES_CACHING_REQUEST_FLAG_TABLE_NAME,
        CACHED_ROUTES_TABLE_NAME,
        AWS_LAMBDA_FUNCTION_NAME,
        V2_PAIRS_CACHE_TABLE_NAME,
      } = process.env

      const dependenciesByChain: {
        [chainId in ChainId]?: ContainerDependencies
      } = {}

      const dependenciesByChainArray = await Promise.all(
        _.map(SUPPORTED_CHAINS, async (chainId: ChainId) => {
          let url = ''
          if (!GlobalRpcProviders.getGlobalUniRpcProviders(log).has(chainId)) {
            // Check existence of env var for chain that doesn't use RPC gateway.
            // (If use RPC gateway, the check for env var will be executed elsewhere.)
            // TODO(jie): Remove this check once we migrate all chains to RPC gateway.
            url = process.env[`WEB3_RPC_${chainId.toString()}`]!
            if (!url) {
              log.fatal({ chainId: chainId }, `Fatal: No Web3 RPC endpoint set for chain`)
              return { chainId, dependencies: {} as ContainerDependencies }
              // This router instance will not be able to route through any chain
              // for which RPC URL is not set
              // For now, if RPC URL is not set for a chain, a request to route
              // on the chain will return Err 500
            }
          }

          let timeout: number
          switch (chainId) {
            case ChainId.ARBITRUM_ONE:
              timeout = 8000
              break
            default:
              timeout = 5000
              break
          }

          let provider: StaticJsonRpcProvider
          if (GlobalRpcProviders.getGlobalUniRpcProviders(log).has(chainId)) {
            // Use RPC gateway.
            provider = GlobalRpcProviders.getGlobalUniRpcProviders(log).get(chainId)!
            ;(provider as UniJsonRpcProvider).shouldEvaluate = false
          } else {
            provider = new DefaultEVMClient({
              allProviders: [
                new InstrumentedEVMProvider({
                  url: {
                    url: url,
                    timeout,
                  },
                  network: chainId,
                  name: deriveProviderName(url),
                }),
              ],
            }).getProvider()
          }

          const tokenCache = new NodeJSCache<Token>(new NodeCache({ stdTTL: 3600, useClones: false }))
          const blockedTokenCache = new NodeJSCache<Token>(new NodeCache({ stdTTL: 3600, useClones: false }))
          const multicall2Provider = new UniswapMulticallProvider(chainId, provider, 375_000)

          const noCacheV3PoolProvider = new V3PoolProvider(chainId, multicall2Provider)
          const inMemoryCachingV3PoolProvider = new CachingV3PoolProvider(
            chainId,
            noCacheV3PoolProvider,
            new NodeJSCache(new NodeCache({ stdTTL: 180, useClones: false }))
          )
          const dynamoCachingV3PoolProvider = new DynamoDBCachingV3PoolProvider(
            chainId,
            noCacheV3PoolProvider,
            'V3PoolsCachingDB'
          )

          const v3PoolProvider = new TrafficSwitchV3PoolProvider({
            currentPoolProvider: inMemoryCachingV3PoolProvider,
            targetPoolProvider: dynamoCachingV3PoolProvider,
            sourceOfTruthPoolProvider: noCacheV3PoolProvider,
          })

          const onChainTokenFeeFetcher = new OnChainTokenFeeFetcher(chainId, provider)
          const graphQLTokenFeeFetcher = new GraphQLTokenFeeFetcher(
            new UniGraphQLProvider(),
            onChainTokenFeeFetcher,
            chainId
          )
          const trafficSwitcherTokenFetcher = new TrafficSwitcherITokenFeeFetcher('TokenFetcherExperimentV2', {
            control: graphQLTokenFeeFetcher,
            treatment: onChainTokenFeeFetcher,
            aliasControl: 'graphQLTokenFeeFetcher',
            aliasTreatment: 'onChainTokenFeeFetcher',
            customization: {
              pctEnabled: 0.0,
              pctShadowSampling: 0.005,
            },
          })

          const tokenValidatorProvider = new TokenValidatorProvider(
            chainId,
            multicall2Provider,
            new NodeJSCache(new NodeCache({ stdTTL: 30000, useClones: false }))
          )
          const tokenPropertiesProvider = new TokenPropertiesProvider(
            chainId,
            new NodeJSCache(new NodeCache({ stdTTL: 30000, useClones: false })),
            trafficSwitcherTokenFetcher
          )
          const underlyingV2PoolProvider = new V2PoolProvider(chainId, multicall2Provider, tokenPropertiesProvider)
          const v2PoolProvider = new CachingV2PoolProvider(
            chainId,
            underlyingV2PoolProvider,
            new V2DynamoCache(V2_PAIRS_CACHE_TABLE_NAME!)
          )

          const [tokenListProvider, blockedTokenListProvider, v3SubgraphProvider, v2SubgraphProvider] =
            await Promise.all([
              AWSTokenListProvider.fromTokenListS3Bucket(chainId, TOKEN_LIST_CACHE_BUCKET!, DEFAULT_TOKEN_LIST),
              CachingTokenListProvider.fromTokenList(chainId, UNSUPPORTED_TOKEN_LIST as TokenList, blockedTokenCache),
              (async () => {
                try {
                  const chainProtocol = chainProtocols.find(
                    (chainProtocol) => chainProtocol.chainId === chainId && chainProtocol.protocol === Protocol.V3
                  )

                  if (!chainProtocol) {
                    throw new Error(`Chain protocol not found for chain ${chainId} and protocol ${Protocol.V3}`)
                  }

                  return await V3AWSSubgraphProvider.EagerBuild(POOL_CACHE_BUCKET_3!, POOL_CACHE_GZIP_KEY!, chainId)
                } catch (err) {
                  log.error({ err }, 'AWS Subgraph Provider unavailable, defaulting to Static Subgraph Provider')
                  return new StaticV3SubgraphProvider(chainId, v3PoolProvider)
                }
              })(),
              (async () => {
                try {
                  const chainProtocol = chainProtocols.find(
                    (chainProtocol) => chainProtocol.chainId === chainId && chainProtocol.protocol === Protocol.V2
                  )

                  if (!chainProtocol) {
                    throw new Error(`Chain protocol not found for chain ${chainId} and protocol ${Protocol.V2}`)
                  }

                  return await V2AWSSubgraphProvider.EagerBuild(POOL_CACHE_BUCKET_3!, POOL_CACHE_GZIP_KEY!, chainId)
                } catch (err) {
                  return new StaticV2SubgraphProvider(chainId)
                }
              })(),
            ])

          const tokenProvider = new CachingTokenProviderWithFallback(
            chainId,
            tokenCache,
            tokenListProvider,
            new TokenProvider(chainId, multicall2Provider)
          )

          // Some providers like Infura set a gas limit per call of 10x block gas which is approx 150m
          // 200*725k < 150m
          let quoteProvider: IOnChainQuoteProvider | undefined = undefined
          switch (chainId) {
            case ChainId.SEPOLIA:
            case ChainId.POLYGON_MUMBAI:
            case ChainId.MAINNET:
            case ChainId.POLYGON:
            case ChainId.BASE:
            case ChainId.ARBITRUM_ONE:
            case ChainId.OPTIMISM:
            case ChainId.BNB:
            case ChainId.CELO:
            case ChainId.AVALANCHE:
            case ChainId.BLAST:
            case ChainId.ZORA:
            case ChainId.ZKSYNC:
              const currentQuoteProvider = new OnChainQuoteProvider(
                chainId,
                provider,
                multicall2Provider,
                RETRY_OPTIONS[chainId],
                (optimisticCachedRoutes, useMixedRouteQuoter) => {
                  const protocol = useMixedRouteQuoter ? Protocol.MIXED : Protocol.V3
                  return optimisticCachedRoutes
                    ? OPTIMISTIC_CACHED_ROUTES_BATCH_PARAMS[protocol][chainId]
                    : NON_OPTIMISTIC_CACHED_ROUTES_BATCH_PARAMS[protocol][chainId]
                },
                GAS_ERROR_FAILURE_OVERRIDES[chainId],
                SUCCESS_RATE_FAILURE_OVERRIDES[chainId],
                BLOCK_NUMBER_CONFIGS[chainId],
                // We will only enable shadow sample mixed quoter on Base
                (useMixedRouteQuoter: boolean) =>
                  useMixedRouteQuoter ? MIXED_ROUTE_QUOTER_V1_ADDRESSES[chainId] : QUOTER_V2_ADDRESSES[chainId]
              )
              const targetQuoteProvider = new OnChainQuoteProvider(
                chainId,
                provider,
                multicall2Provider,
                RETRY_OPTIONS[chainId],
                (optimisticCachedRoutes, useMixedRouteQuoter) => {
                  const protocol = useMixedRouteQuoter ? Protocol.MIXED : Protocol.V3
                  return optimisticCachedRoutes
                    ? OPTIMISTIC_CACHED_ROUTES_BATCH_PARAMS[protocol][chainId]
                    : NON_OPTIMISTIC_CACHED_ROUTES_BATCH_PARAMS[protocol][chainId]
                },
                GAS_ERROR_FAILURE_OVERRIDES[chainId],
                SUCCESS_RATE_FAILURE_OVERRIDES[chainId],
                BLOCK_NUMBER_CONFIGS[chainId],
                (useMixedRouteQuoter: boolean) =>
                  useMixedRouteQuoter ? MIXED_ROUTE_QUOTER_V1_ADDRESSES[chainId] : NEW_QUOTER_V2_ADDRESSES[chainId],
                (chainId: ChainId, useMixedRouteQuoter: boolean, optimisticCachedRoutes: boolean) =>
                  useMixedRouteQuoter
                    ? `ChainId_${chainId}_ShadowMixedQuoter_OptimisticCachedRoutes${optimisticCachedRoutes}_`
                    : `ChainId_${chainId}_ShadowV3Quoter_OptimisticCachedRoutes${optimisticCachedRoutes}_`
              )
              quoteProvider = new TrafficSwitchOnChainQuoteProvider({
                currentQuoteProvider: currentQuoteProvider,
                targetQuoteProvider: targetQuoteProvider,
                chainId: chainId,
              })
              break
          }

          const portionProvider = new PortionProvider()
          const tenderlySimulator = new TenderlySimulator(
            chainId,
            'https://api.tenderly.co',
            process.env.TENDERLY_USER!,
            process.env.TENDERLY_PROJECT!,
            process.env.TENDERLY_ACCESS_KEY!,
            process.env.TENDERLY_NODE_API_KEY!,
            v2PoolProvider,
            v3PoolProvider,
            provider,
            portionProvider,
            undefined,
            // The timeout for the underlying axios call to Tenderly, measured in milliseconds.
            2.5 * 1000,
            100,
            [ChainId.MAINNET]
          )

          const ethEstimateGasSimulator = new EthEstimateGasSimulator(
            chainId,
            provider,
            v2PoolProvider,
            v3PoolProvider,
            portionProvider
          )

          const simulator = new FallbackTenderlySimulator(
            chainId,
            provider,
            portionProvider,
            tenderlySimulator,
            ethEstimateGasSimulator
          )

          let routeCachingProvider: IRouteCachingProvider | undefined = undefined
          if (CACHED_ROUTES_TABLE_NAME && CACHED_ROUTES_TABLE_NAME !== '') {
            routeCachingProvider = new DynamoRouteCachingProvider({
              routesTableName: ROUTES_TABLE_NAME!,
              routesCachingRequestFlagTableName: ROUTES_CACHING_REQUEST_FLAG_TABLE_NAME!,
              cachingQuoteLambdaName: AWS_LAMBDA_FUNCTION_NAME!,
            })
          }

          const v2Supported = [
            ChainId.MAINNET,
            ChainId.ARBITRUM_ONE,
            ChainId.OPTIMISM,
            ChainId.POLYGON,
            ChainId.BASE,
            ChainId.BNB,
            ChainId.AVALANCHE,
            ChainId.BLAST,
          ]

          return {
            chainId,
            dependencies: {
              provider,
              tokenListProvider,
              blockedTokenListProvider,
              multicallProvider: multicall2Provider,
              tokenProvider,
              tokenProviderFromTokenList: tokenListProvider,
              gasPriceProvider: new CachingGasStationProvider(
                chainId,
                new OnChainGasPriceProvider(
                  chainId,
                  new EIP1559GasPriceProvider(provider),
                  new LegacyGasPriceProvider(provider)
                ),
                new NodeJSCache(new NodeCache({ stdTTL: 15, useClones: false }))
              ),
              v3SubgraphProvider,
              onChainQuoteProvider: quoteProvider,
              v3PoolProvider,
              v2PoolProvider,
              v2QuoteProvider: new V2QuoteProvider(),
              v2SubgraphProvider,
              simulator,
              routeCachingProvider,
              tokenValidatorProvider,
              tokenPropertiesProvider,
              v2Supported,
            },
          }
        })
      )

      for (const { chainId, dependencies } of dependenciesByChainArray) {
        dependenciesByChain[chainId] = dependencies
      }

      return {
        dependencies: dependenciesByChain,
        activityId: activityId,
      }
    } catch (err) {
      log.fatal({ err }, `Fatal: Failed to build container`)
      throw err
    }
  }
}
