import { ChainId, Token } from '@uniswap/sdk-core'
import {
  CachingGasStationProvider,
  CachingTokenListProvider,
  CachingTokenProviderWithFallback,
  CachingV3PoolProvider,
  EIP1559GasPriceProvider,
  EthEstimateGasSimulator,
  IGasPriceProvider,
  IMetric,
  IOnChainQuoteProvider,
  IRouteCachingProvider,
  ITokenListProvider,
  ITokenPropertiesProvider,
  ITokenProvider,
  IV3PoolProvider,
  IV3SubgraphProvider,
  LegacyGasPriceProvider,
  NodeJSCache,
  OnChainGasPriceProvider,
  OnChainQuoteProvider,
  QUOTER_V2_ADDRESSES,
  setGlobalLogger,
  Simulator,
  StaticV3SubgraphProvider,
  TokenPropertiesProvider,
  TokenProvider,
  TokenValidatorProvider,
  UniswapMulticallProvider,
  V3PoolProvider,
} from '@uniswap/smart-order-router'
import { TokenList } from '@uniswap/token-lists'
import { default as bunyan, default as Logger } from 'bunyan'
import _ from 'lodash'
import NodeCache from 'node-cache'
import UNSUPPORTED_TOKEN_LIST from './../config/unsupported.tokenlist.json'
import { BaseRInj, Injector } from './handler'
import { V3AWSSubgraphProvider } from './router-entities/aws-subgraph-provider'
import { AWSTokenListProvider } from './router-entities/aws-token-list-provider'
import { DynamoRouteCachingProvider } from './router-entities/route-caching/dynamo-route-caching-provider'
import { DynamoDBCachingV3PoolProvider } from './pools/pool-caching/v3/dynamo-caching-pool-provider'
import { TrafficSwitchV3PoolProvider } from './pools/provider-migration/v3/traffic-switch-v3-pool-provider'
import { DefaultEVMClient } from './evm/EVMClient'
import { InstrumentedEVMProvider } from './evm/provider/InstrumentedEVMProvider'
import { deriveProviderName } from './evm/provider/ProviderName'
import { OnChainTokenFeeFetcher } from '@uniswap/smart-order-router/build/main/providers/token-fee-fetcher'
import { PortionProvider } from '@uniswap/smart-order-router/build/main/providers/portion-provider'
import { GlobalRpcProviders } from '../rpc/GlobalRpcProviders'
import { StaticJsonRpcProvider } from '@ethersproject/providers'
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
import { NEW_CACHED_ROUTES_ROLLOUT_PERCENT } from '../util/newCachedRoutesRolloutPercent'
import { ZK_EVM_TESTNET_CHAIN_ID } from '../constants/zk-evm'

export const SUPPORTED_CHAINS: ChainId[] = [ZK_EVM_TESTNET_CHAIN_ID]
const DEFAULT_TOKEN_LIST = 'https://gateway.ipfs.io/ipns/tokens.uniswap.org'

export interface RequestInjected<Router> extends BaseRInj {
  chainId: ChainId
  metric: IMetric
  v3PoolProvider: IV3PoolProvider
  tokenProvider: ITokenProvider
  tokenListProvider: ITokenListProvider
  router: Router
  quoteSpeed?: string
  intent?: string
}

export type ContainerDependencies = {
  provider: StaticJsonRpcProvider
  v3SubgraphProvider: IV3SubgraphProvider
  tokenListProvider: ITokenListProvider
  gasPriceProvider: IGasPriceProvider
  tokenProviderFromTokenList: ITokenProvider
  blockedTokenListProvider: ITokenListProvider
  v3PoolProvider: IV3PoolProvider
  tokenProvider: ITokenProvider
  multicallProvider: UniswapMulticallProvider
  onChainQuoteProvider?: IOnChainQuoteProvider
  simulator: Simulator
  routeCachingProvider?: IRouteCachingProvider
  tokenValidatorProvider: TokenValidatorProvider
  tokenPropertiesProvider: ITokenPropertiesProvider
  cachedRoutesCacheInvalidationFixRolloutPercentage?: number
  deleteCacheEnabledChains?: ChainId[]
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
        CACHING_ROUTING_LAMBDA_FUNCTION_NAME,
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

          // V3-only pool provider with DynamoDB caching
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

          // Use OnChainTokenFeeFetcher only (no GraphQL)
          const onChainTokenFeeFetcher = new OnChainTokenFeeFetcher(chainId, provider)

          const tokenValidatorProvider = new TokenValidatorProvider(
            chainId,
            multicall2Provider,
            new NodeJSCache(new NodeCache({ stdTTL: 30000, useClones: false }))
          )
          const tokenPropertiesProvider = new TokenPropertiesProvider(
            chainId,
            new NodeJSCache(new NodeCache({ stdTTL: 30000, useClones: false })),
            onChainTokenFeeFetcher
          )

          const [tokenListProvider, blockedTokenListProvider, v3SubgraphProvider] = await Promise.all([
            AWSTokenListProvider.fromTokenListS3Bucket(chainId, TOKEN_LIST_CACHE_BUCKET!, DEFAULT_TOKEN_LIST),
            CachingTokenListProvider.fromTokenList(chainId, UNSUPPORTED_TOKEN_LIST as TokenList, blockedTokenCache),
            (await this.instantiateSubgraphProvider(
              chainId,
              Protocol.V3,
              POOL_CACHE_BUCKET_3!,
              POOL_CACHE_GZIP_KEY!,
              v3PoolProvider
            )) as V3AWSSubgraphProvider,
          ])

          const tokenProvider = new CachingTokenProviderWithFallback(
            chainId,
            tokenCache,
            tokenListProvider,
            new TokenProvider(chainId, multicall2Provider)
          )

          // V3-only quote provider for zkEVM testnet
          let quoteProvider: IOnChainQuoteProvider | undefined = undefined
          if (chainId === (ZK_EVM_TESTNET_CHAIN_ID as ChainId)) {
            quoteProvider = new OnChainQuoteProvider(
              chainId,
              provider,
              multicall2Provider,
              RETRY_OPTIONS[chainId] || { retries: 2, minTimeout: 100, maxTimeout: 1000 },
              (optimisticCachedRoutes, _protocol) => {
                const protocol = Protocol.V3
                return optimisticCachedRoutes
                  ? OPTIMISTIC_CACHED_ROUTES_BATCH_PARAMS[protocol][chainId] || {
                      batchSize: 2,
                      gasLimitPerCall: 1_000_000,
                      dropUnexecutedFetches: true,
                    }
                  : NON_OPTIMISTIC_CACHED_ROUTES_BATCH_PARAMS[protocol][chainId] || {
                      batchSize: 2,
                      gasLimitPerCall: 1_000_000,
                      dropUnexecutedFetches: false,
                    }
              },
              (_protocol) => GAS_ERROR_FAILURE_OVERRIDES[chainId] || { gasLimitOverride: 2_000_000, maxTimes: 3 },
              (_protocol) => SUCCESS_RATE_FAILURE_OVERRIDES[chainId] || { successRateFailureOverrides: [] },
              (_protocol) => BLOCK_NUMBER_CONFIGS[chainId] || { baseBlockOffset: 0, rollback: { enabled: false } },
              (_useMixedRouteQuoter, _mixedRouteContainsV4Pool, _protocol) => QUOTER_V2_ADDRESSES[chainId]
            )
          }

          const portionProvider = new PortionProvider()

          // Use EthEstimateGasSimulator only (no Tenderly) - V3 only, no V2/V4
          const simulator = new EthEstimateGasSimulator(
            chainId,
            provider,
            undefined as any, // v2PoolProvider - not used (V2 not supported)
            v3PoolProvider,
            undefined as any, // v4PoolProvider - not used (V4 not supported)
            portionProvider
          )
          const newCachedRoutesRolloutPercent = NEW_CACHED_ROUTES_ROLLOUT_PERCENT[chainId]

          let routeCachingProvider: IRouteCachingProvider | undefined = undefined

          // if the newCachedRoutesRolloutPercent is greater than the random number, use the new caching routing lambda function name,
          // so that the caching intent quote handler will invoke the even to the newly created caching routing lambda
          const cachingQuoteLambdaName =
            Math.random() * 100 < (newCachedRoutesRolloutPercent ?? 0)
              ? CACHING_ROUTING_LAMBDA_FUNCTION_NAME
              : AWS_LAMBDA_FUNCTION_NAME!

          if (CACHED_ROUTES_TABLE_NAME && CACHED_ROUTES_TABLE_NAME !== '') {
            routeCachingProvider = new DynamoRouteCachingProvider({
              routesTableName: ROUTES_TABLE_NAME!,
              routesCachingRequestFlagTableName: ROUTES_CACHING_REQUEST_FLAG_TABLE_NAME!,
              cachingQuoteLambdaName: cachingQuoteLambdaName,
            })
          }

          // V3-only support - no V2, V4, or mixed routes
          const deleteCacheEnabledChains = [ZK_EVM_TESTNET_CHAIN_ID]
          const cachedRoutesCacheInvalidationFixRolloutPercentage = NEW_CACHED_ROUTES_ROLLOUT_PERCENT[chainId]

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
              simulator,
              routeCachingProvider,
              tokenValidatorProvider,
              tokenPropertiesProvider,
              cachedRoutesCacheInvalidationFixRolloutPercentage,
              deleteCacheEnabledChains,
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

  private async instantiateSubgraphProvider(
    chainId: ChainId,
    protocol: Protocol,
    poolCacheBucket: string,
    poolCacheKey: string,
    poolProvider: IV3PoolProvider
  ) {
    try {
      const chainProtocol = chainProtocols.find(
        (chainProtocol) => chainProtocol.chainId === chainId && chainProtocol.protocol === protocol
      )

      if (!chainProtocol) {
        throw new Error(`Chain protocol not found for chain ${chainId} and protocol ${protocol}`)
      }

      // V3 only
      if (protocol === Protocol.V3) {
        return await V3AWSSubgraphProvider.EagerBuild(poolCacheBucket!, poolCacheKey!, chainId)
      } else {
        throw new Error(`Unsupported protocol ${protocol} for chain ${chainId} - only V3 supported`)
      }
    } catch (err) {
      // Fallback to static V3 subgraph provider
      if (protocol === Protocol.V3) {
        return new StaticV3SubgraphProvider(chainId, poolProvider)
      } else {
        throw new Error(`Unsupported protocol ${protocol} for chain ${chainId} - only V3 supported`)
      }
    }
  }
}
