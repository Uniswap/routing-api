import { ChainId } from '@uniswap/sdk-core'
import * as cdk from 'aws-cdk-lib'
import { CfnOutput, Stack, StackProps, Stage, StageProps } from 'aws-cdk-lib'
import * as chatbot from 'aws-cdk-lib/aws-chatbot'
import { BuildEnvironmentVariableType } from 'aws-cdk-lib/aws-codebuild'
import { PipelineNotificationEvents } from 'aws-cdk-lib/aws-codepipeline'
import * as sm from 'aws-cdk-lib/aws-secretsmanager'
import { CodeBuildStep, CodePipeline, CodePipelineSource } from 'aws-cdk-lib/pipelines'
import { Construct } from 'constructs'
import dotenv from 'dotenv'
import 'source-map-support/register'
import { SUPPORTED_CHAINS } from '../lib/handlers/injector-sor'
import { STAGE } from '../lib/util/stage'
import { RoutingAPIStack } from './stacks/routing-api-stack'

dotenv.config()

export class RoutingAPIStage extends Stage {
  public readonly url: CfnOutput

  constructor(
    scope: Construct,
    id: string,
    props: StageProps & {
      jsonRpcProviders: { [chainName: string]: string }
      provisionedConcurrency: number
      ethGasStationInfoUrl: string
      chatbotSNSArn?: string
      stage: string
      internalApiKey?: string
      route53Arn?: string
      pinata_key?: string
      pinata_secret?: string
      hosted_zone?: string
      tenderlyUser: string
      tenderlyProject: string
      tenderlyAccessKey: string
      tenderlyNodeApiKey: string
      unicornSecret: string
      alchemyQueryKey?: string
      alchemyQueryKey2?: string
      graphBaseV4SubgraphId?: string
      graphBearerToken?: string
      uniGraphQLEndpoint: string
      uniGraphQLHeaderOrigin: string
      goldskyBearerToken?: string
      goldskyApiKey?: string
      // Goldsky V2 subgraph IDs
      goldskyEthereumV2Id?: string
      goldskyArbitrumV2Id?: string
      goldskyPolygonV2Id?: string
      goldskyOptimismV2Id?: string
      goldskyAvalancheV2Id?: string
      goldskyBnbV2Id?: string
      goldskyBlastV2Id?: string
      goldskyBaseV2Id?: string
      goldskyWorldchainV2Id?: string
      goldskyAstrochainSepoliaV2Id?: string
      goldskyMonadTestnetV2Id?: string
      goldskyUnichainV2Id?: string
      goldskySoneiumV2Id?: string
      goldskyEthereumSepoliaV2Id?: string
      // Goldsky V3 subgraph IDs
      goldskyEthereumV3Id?: string
      goldskyArbitrumV3Id?: string
      goldskyPolygonV3Id?: string
      goldskyOptimismV3Id?: string
      goldskyAvalancheV3Id?: string
      goldskyBnbV3Id?: string
      goldskyBlastV3Id?: string
      goldskyBaseV3Id?: string
      goldskyCeloV3Id?: string
      goldskyWorldchainV3Id?: string
      goldskyAstrochainSepoliaV3Id?: string
      goldskyUnichainV3Id?: string
      goldskyZoraV3Id?: string
      goldskySoneiumV3Id?: string
      // Goldsky V4 subgraph IDs
      goldskyEthereumSepoliaV4Id?: string
      goldskyArbitrumV4Id?: string
      goldskyBaseV4Id?: string
      goldskyPolygonV4Id?: string
      goldskyWorldchainV4Id?: string
      goldskyZoraV4Id?: string
      goldskyUnichainV4Id?: string
      goldskyBnbV4Id?: string
      goldskyBlastV4Id?: string
      goldskyEthereumV4Id?: string
      goldskySoneiumV4Id?: string
      goldskyOptimismV4Id?: string
      goldskyCeloV4Id?: string
      goldskyAvalancheV4Id?: string
    }
  ) {
    super(scope, id, props)
    const {
      jsonRpcProviders,
      provisionedConcurrency,
      ethGasStationInfoUrl,
      chatbotSNSArn,
      stage,
      internalApiKey,
      route53Arn,
      pinata_key,
      pinata_secret,
      hosted_zone,
      tenderlyUser,
      tenderlyProject,
      tenderlyAccessKey,
      tenderlyNodeApiKey,
      unicornSecret,
      alchemyQueryKey,
      alchemyQueryKey2,
      graphBaseV4SubgraphId,
      graphBearerToken,
      uniGraphQLEndpoint,
      uniGraphQLHeaderOrigin,
      goldskyBearerToken,
      goldskyApiKey,
      // Goldsky V2 subgraph IDs
      goldskyEthereumV2Id,
      goldskyArbitrumV2Id,
      goldskyPolygonV2Id,
      goldskyOptimismV2Id,
      goldskyAvalancheV2Id,
      goldskyBnbV2Id,
      goldskyBlastV2Id,
      goldskyBaseV2Id,
      goldskyWorldchainV2Id,
      goldskyAstrochainSepoliaV2Id,
      goldskyMonadTestnetV2Id,
      goldskyUnichainV2Id,
      goldskySoneiumV2Id,
      goldskyEthereumSepoliaV2Id,
      // Goldsky V3 subgraph IDs
      goldskyEthereumV3Id,
      goldskyArbitrumV3Id,
      goldskyPolygonV3Id,
      goldskyOptimismV3Id,
      goldskyAvalancheV3Id,
      goldskyBnbV3Id,
      goldskyBlastV3Id,
      goldskyBaseV3Id,
      goldskyCeloV3Id,
      goldskyWorldchainV3Id,
      goldskyAstrochainSepoliaV3Id,
      goldskyUnichainV3Id,
      goldskyZoraV3Id,
      goldskySoneiumV3Id,
      // Goldsky V4 subgraph IDs
      goldskyEthereumSepoliaV4Id,
      goldskyArbitrumV4Id,
      goldskyBaseV4Id,
      goldskyPolygonV4Id,
      goldskyWorldchainV4Id,
      goldskyZoraV4Id,
      goldskyUnichainV4Id,
      goldskyBnbV4Id,
      goldskyBlastV4Id,
      goldskyEthereumV4Id,
      goldskySoneiumV4Id,
      goldskyOptimismV4Id,
      goldskyCeloV4Id,
      goldskyAvalancheV4Id,
    } = props

    const { url } = new RoutingAPIStack(this, 'RoutingAPI', {
      jsonRpcProviders,
      provisionedConcurrency,
      ethGasStationInfoUrl,
      chatbotSNSArn,
      stage,
      internalApiKey,
      route53Arn,
      pinata_key,
      pinata_secret,
      hosted_zone,
      tenderlyUser,
      tenderlyProject,
      tenderlyAccessKey,
      tenderlyNodeApiKey,
      unicornSecret,
      alchemyQueryKey,
      alchemyQueryKey2,
      graphBaseV4SubgraphId,
      graphBearerToken,
      uniGraphQLEndpoint,
      uniGraphQLHeaderOrigin,
      goldskyBearerToken,
      goldskyApiKey,
      // Goldsky V2 subgraph IDs
      goldskyEthereumV2Id,
      goldskyArbitrumV2Id,
      goldskyPolygonV2Id,
      goldskyOptimismV2Id,
      goldskyAvalancheV2Id,
      goldskyBnbV2Id,
      goldskyBlastV2Id,
      goldskyBaseV2Id,
      goldskyWorldchainV2Id,
      goldskyAstrochainSepoliaV2Id,
      goldskyMonadTestnetV2Id,
      goldskyUnichainV2Id,
      goldskySoneiumV2Id,
      goldskyEthereumSepoliaV2Id,
      // Goldsky V3 subgraph IDs
      goldskyEthereumV3Id,
      goldskyArbitrumV3Id,
      goldskyPolygonV3Id,
      goldskyOptimismV3Id,
      goldskyAvalancheV3Id,
      goldskyBnbV3Id,
      goldskyBlastV3Id,
      goldskyBaseV3Id,
      goldskyCeloV3Id,
      goldskyWorldchainV3Id,
      goldskyAstrochainSepoliaV3Id,
      goldskyUnichainV3Id,
      goldskyZoraV3Id,
      goldskySoneiumV3Id,
      // Goldsky V4 subgraph IDs
      goldskyEthereumSepoliaV4Id,
      goldskyArbitrumV4Id,
      goldskyBaseV4Id,
      goldskyPolygonV4Id,
      goldskyWorldchainV4Id,
      goldskyZoraV4Id,
      goldskyUnichainV4Id,
      goldskyBnbV4Id,
      goldskyBlastV4Id,
      goldskyEthereumV4Id,
      goldskySoneiumV4Id,
      goldskyOptimismV4Id,
      goldskyCeloV4Id,
      goldskyAvalancheV4Id,
    })
    this.url = url
  }
}

export class RoutingAPIPipeline extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    // update to use codestar for standard connections
    const code = CodePipelineSource.connection('Uniswap/routing-api', 'main', {
      connectionArn:
        'arn:aws:codestar-connections:us-east-2:644039819003:connection/4806faf1-c31e-4ea2-a5bf-c6fc1fa79487',
    })

    const synthStep = new CodeBuildStep('Synth', {
      input: code,
      buildEnvironment: {
        environmentVariables: {
          NPM_TOKEN: {
            value: 'npm-private-repo-access-token',
            type: BuildEnvironmentVariableType.SECRETS_MANAGER,
          },
        },
      },
      commands: [
        'echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc && npm ci',
        'npm run build',
        'npx cdk synth',
      ],
    })

    const pipeline = new CodePipeline(this, 'RoutingAPIPipeline', {
      // The pipeline name
      pipelineName: 'RoutingAPI',
      crossAccountKeys: true,
      synth: synthStep,
    })

    // Secrets are stored in secrets manager in the pipeline account. Accounts we deploy to
    // have been granted permissions to access secrets via resource policies.

    const jsonRpcProvidersSecret = sm.Secret.fromSecretAttributes(this, 'RPCProviderUrls', {
      // The main secrets use our Infura RPC urls
      secretCompleteArn:
        'arn:aws:secretsmanager:us-east-2:644039819003:secret:routing-api-rpc-urls-json-primary-ixS8mw',

      /*
      The backup secrets mostly use our Alchemy RPC urls
      However Alchemy does not support Rinkeby, Ropsten, and Kovan
      So those chains are set to our Infura RPC urls
      When switching to the backups,
      we must set the multicall chunk size to 50 so that optimism
      does not bug out on Alchemy's end
      */
      //secretCompleteArn: arn:aws:secretsmanager:us-east-2:644039819003:secret:routing-api-rpc-urls-json-backup-D2sWoe
    })

    // Secret that controls the access to the debugging query string params
    const unicornSecrets = sm.Secret.fromSecretAttributes(this, 'DebugConfigUnicornSecrets', {
      secretCompleteArn: 'arn:aws:secretsmanager:us-east-2:644039819003:secret:debug-config-unicornsecrets-jvmCsq',
    })

    const tenderlyCreds = sm.Secret.fromSecretAttributes(this, 'TenderlyCreds', {
      secretCompleteArn: 'arn:aws:secretsmanager:us-east-2:644039819003:secret:tenderly-api-wQaI2R',
    })

    const ethGasStationInfoUrl = sm.Secret.fromSecretAttributes(this, 'ETHGasStationUrl', {
      secretCompleteArn: 'arn:aws:secretsmanager:us-east-2:644039819003:secret:eth-gas-station-info-url-ulGncX',
    })

    const pinataApi = sm.Secret.fromSecretAttributes(this, 'PinataAPI', {
      secretCompleteArn: 'arn:aws:secretsmanager:us-east-2:644039819003:secret:pinata-api-key-UVLAfM',
    })
    const route53Arn = sm.Secret.fromSecretAttributes(this, 'Route53Arn', {
      secretCompleteArn: 'arn:aws:secretsmanager:us-east-2:644039819003:secret:Route53Arn-elRmmw',
    })

    const pinataSecret = sm.Secret.fromSecretAttributes(this, 'PinataSecret', {
      secretCompleteArn: 'arn:aws:secretsmanager:us-east-2:644039819003:secret:pinata-secret-svGaPt',
    })

    const hostedZone = sm.Secret.fromSecretAttributes(this, 'HostedZone', {
      secretCompleteArn: 'arn:aws:secretsmanager:us-east-2:644039819003:secret:hosted-zone-JmPDNV',
    })

    const internalApiKey = sm.Secret.fromSecretAttributes(this, 'internal-api-key', {
      secretCompleteArn: 'arn:aws:secretsmanager:us-east-2:644039819003:secret:routing-api-internal-api-key-Z68NmB',
    })

    const routingApiNewSecrets = sm.Secret.fromSecretAttributes(this, 'RoutingApiNewSecrets', {
      secretCompleteArn: 'arn:aws:secretsmanager:us-east-2:644039819003:secret:RoutingApiNewSecrets-7EijpM',
    })

    // ALchemy subgraphs are split between two accounts, hence the two keys alchemy-query-key and alchemy-query-key-2
    const alchemySubgraphSecret = sm.Secret.fromSecretAttributes(this, 'RoutingAlchemySubgraphSecret', {
      secretCompleteArn: 'arn:aws:secretsmanager:us-east-2:644039819003:secret:RoutingAlchemySubgraphSecret-QKtgMX',
    })

    // Load RPC provider URLs from AWS secret
    let jsonRpcProviders = {} as { [chainId: string]: string }
    SUPPORTED_CHAINS.forEach((chainId: ChainId) => {
      // Exclude newly introduced chains here. This section can be probably removed but needs to be tested.
      if (
        chainId !== ChainId.WORLDCHAIN &&
        chainId !== ChainId.UNICHAIN_SEPOLIA &&
        chainId !== ChainId.MONAD_TESTNET &&
        chainId !== ChainId.MONAD &&
        chainId !== ChainId.BASE_SEPOLIA &&
        chainId !== ChainId.UNICHAIN &&
        chainId !== ChainId.SONEIUM &&
        chainId !== ChainId.XLAYER
      ) {
        const key = `WEB3_RPC_${chainId}`
        jsonRpcProviders[key] = jsonRpcProvidersSecret.secretValueFromJson(key).toString()
        new CfnOutput(this, key, {
          value: jsonRpcProviders[key],
        })
      }
    })

    // Load RPC provider URLs from AWS secret (for RPC Gateway)
    const RPC_GATEWAY_PROVIDERS = [
      // Optimism
      // 'INFURA_10',
      'QUICKNODE_10',
      'ALCHEMY_10',
      // Polygon
      'QUICKNODE_137',
      // 'INFURA_137',
      'ALCHEMY_137',
      // Celo
      'QUICKNODE_42220',
      // 'INFURA_42220',
      // Avalanche
      // 'INFURA_43114',
      'QUICKNODE_43114',
      // BNB
      'QUICKNODE_56',
      // Base
      'QUICKNODE_8453',
      // 'INFURA_8453',
      'ALCHEMY_8453',
      // Sepolia
      // 'INFURA_11155111',
      'ALCHEMY_11155111',
      // Arbitrum
      // 'INFURA_42161',
      'QUICKNODE_42161',
      'ALCHEMY_42161',
      // Ethereum
      // 'INFURA_1',
      'QUICKNODE_1',
      'ALCHEMY_1',
      'QUICKNODERETH_1',
      // Blast
      'QUICKNODE_81457',
      // 'INFURA_81457',
      // ZORA
      'QUICKNODE_7777777',
      // ZkSync
      'QUICKNODE_324',
      'ALCHEMY_324',
      // WorldChain,
      'QUICKNODE_480',
      // Unichain Sepolia,
      'QUICKNODE_1301',
      'ALCHEMY_1301',
      // unirpc - serves all chains
      'UNIRPC_0',
    ]
    for (const provider of RPC_GATEWAY_PROVIDERS) {
      jsonRpcProviders[provider] = jsonRpcProvidersSecret.secretValueFromJson(provider).toString()
      new CfnOutput(this, provider, {
        value: jsonRpcProviders[provider],
      })
    }

    // Beta us-east-2
    const betaUsEast2Stage = new RoutingAPIStage(this, 'beta-us-east-2', {
      env: { account: '145079444317', region: 'us-east-2' },
      jsonRpcProviders: jsonRpcProviders,
      internalApiKey: internalApiKey.secretValue.toString(),
      provisionedConcurrency: 5,
      ethGasStationInfoUrl: ethGasStationInfoUrl.secretValue.toString(),
      stage: STAGE.BETA,
      route53Arn: route53Arn.secretValueFromJson('arn').toString(),
      pinata_key: pinataApi.secretValueFromJson('pinata-api-key').toString(),
      pinata_secret: pinataSecret.secretValueFromJson('secret').toString(),
      hosted_zone: hostedZone.secretValueFromJson('zone').toString(),
      tenderlyUser: tenderlyCreds.secretValueFromJson('tenderly-user').toString(),
      tenderlyProject: tenderlyCreds.secretValueFromJson('tenderly-project').toString(),
      tenderlyAccessKey: tenderlyCreds.secretValueFromJson('tenderly-access-key').toString(),
      tenderlyNodeApiKey: tenderlyCreds.secretValueFromJson('tenderly-node-api-key').toString(),
      unicornSecret: unicornSecrets.secretValueFromJson('debug-config-unicorn-key').toString(),
      alchemyQueryKey: alchemySubgraphSecret.secretValueFromJson('alchemy-query-key').toString(),
      alchemyQueryKey2: alchemySubgraphSecret.secretValueFromJson('alchemy-query-key-2').toString(),
      // bearer token and base subgraph id are not from alchemy subgraph, but from the graph
      // below secret namings are wrong, but we take it as is
      graphBearerToken: alchemySubgraphSecret.secretValueFromJson('alchemy-bearer-token').toString(),
      graphBaseV4SubgraphId: alchemySubgraphSecret.secretValueFromJson('alchemy-base-v4-subgraph-id').toString(),
      uniGraphQLEndpoint: routingApiNewSecrets.secretValueFromJson('uni-graphql-endpoint').toString(),
      uniGraphQLHeaderOrigin: routingApiNewSecrets.secretValueFromJson('uni-graphql-header-origin').toString(),
      goldskyBearerToken: routingApiNewSecrets.secretValueFromJson('GOLDSKY_BEARER_TOKEN').toString(),
      goldskyApiKey: routingApiNewSecrets.secretValueFromJson('GOLDSKY_API_KEY').toString(),
      // Goldsky V2 subgraph IDs
      goldskyEthereumV2Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_ETHEREUM_V2_ID').toString(),
      goldskyArbitrumV2Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_ARBITRUM_V2_ID').toString(),
      goldskyPolygonV2Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_POLYGON_V2_ID').toString(),
      goldskyOptimismV2Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_OPTIMISM_V2_ID').toString(),
      goldskyAvalancheV2Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_AVALANCHE_V2_ID').toString(),
      goldskyBnbV2Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_BNB_V2_ID').toString(),
      goldskyBlastV2Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_BLAST_V2_ID').toString(),
      goldskyBaseV2Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_BASE_V2_ID').toString(),
      goldskyWorldchainV2Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_WORLDCHAIN_V2_ID').toString(),
      goldskyAstrochainSepoliaV2Id: routingApiNewSecrets
        .secretValueFromJson('GOLD_SKY_ASTROCHAIN_SEPOLIA_V2_ID')
        .toString(),
      goldskyMonadTestnetV2Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_MONAD_TESTNET_V2_ID').toString(),
      goldskyUnichainV2Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_UNICHAIN_V2_ID').toString(),
      goldskySoneiumV2Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_SONEIUM_V2_ID').toString(),
      goldskyEthereumSepoliaV2Id: routingApiNewSecrets
        .secretValueFromJson('GOLD_SKY_ETHEREUM_SEPOLIA_V2_ID')
        .toString(),
      // Goldsky V3 subgraph IDs
      goldskyEthereumV3Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_ETHEREUM_V3_ID').toString(),
      goldskyArbitrumV3Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_ARBITRUM_V3_ID').toString(),
      goldskyPolygonV3Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_POLYGON_V3_ID').toString(),
      goldskyOptimismV3Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_OPTIMISM_V3_ID').toString(),
      goldskyAvalancheV3Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_AVALANCHE_V3_ID').toString(),
      goldskyBnbV3Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_BNB_V3_ID').toString(),
      goldskyBlastV3Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_BLAST_V3_ID').toString(),
      goldskyBaseV3Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_BASE_V3_ID').toString(),
      goldskyCeloV3Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_CELO_V3_ID').toString(),
      goldskyWorldchainV3Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_WORLDCHAIN_V3_ID').toString(),
      goldskyAstrochainSepoliaV3Id: routingApiNewSecrets
        .secretValueFromJson('GOLD_SKY_ASTROCHAIN_SEPOLIA_V3_ID')
        .toString(),
      goldskyUnichainV3Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_UNICHAIN_V3_ID').toString(),
      goldskyZoraV3Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_ZORA_V3_ID').toString(),
      goldskySoneiumV3Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_SONEIUM_V3_ID').toString(),
      // Goldsky V4 subgraph IDs
      goldskyEthereumSepoliaV4Id: routingApiNewSecrets
        .secretValueFromJson('GOLD_SKY_ETHEREUM_SEPOLIA_V4_ID')
        .toString(),
      goldskyArbitrumV4Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_ARBITRUM_V4_ID').toString(),
      goldskyBaseV4Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_BASE_V4_ID').toString(),
      goldskyPolygonV4Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_POLYGON_V4_ID').toString(),
      goldskyWorldchainV4Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_WORLDCHAIN_V4_ID').toString(),
      goldskyZoraV4Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_ZORA_V4_ID').toString(),
      goldskyUnichainV4Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_UNICHAIN_V4_ID').toString(),
      goldskyBnbV4Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_BNB_V4_ID').toString(),
      goldskyBlastV4Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_BLAST_V4_ID').toString(),
      goldskyEthereumV4Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_ETHEREUM_V4_ID').toString(),
      goldskySoneiumV4Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_SONEIUM_V4_ID').toString(),
      goldskyOptimismV4Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_OPTIMISM_V4_ID').toString(),
      goldskyCeloV4Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_CELO_V4_ID').toString(),
      goldskyAvalancheV4Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_AVALANCHE_V4_ID').toString(),
    })

    const betaUsEast2AppStage = pipeline.addStage(betaUsEast2Stage)

    const unicornSecret = unicornSecrets.secretValueFromJson('debug-config-unicorn-key').toString()
    this.addIntegTests(code, betaUsEast2Stage, betaUsEast2AppStage, unicornSecret)

    // Prod us-east-2
    const prodUsEast2Stage = new RoutingAPIStage(this, 'prod-us-east-2', {
      env: { account: '606857263320', region: 'us-east-2' },
      jsonRpcProviders: jsonRpcProviders,
      internalApiKey: internalApiKey.secretValue.toString(),
      provisionedConcurrency: 70,
      ethGasStationInfoUrl: ethGasStationInfoUrl.secretValue.toString(),
      chatbotSNSArn: 'arn:aws:sns:us-east-2:644039819003:SlackChatbotTopic',
      stage: STAGE.PROD,
      route53Arn: route53Arn.secretValueFromJson('arn').toString(),
      pinata_key: pinataApi.secretValueFromJson('pinata-api-key').toString(),
      pinata_secret: pinataSecret.secretValueFromJson('secret').toString(),
      hosted_zone: hostedZone.secretValueFromJson('zone').toString(),
      tenderlyUser: tenderlyCreds.secretValueFromJson('tenderly-user').toString(),
      tenderlyProject: tenderlyCreds.secretValueFromJson('tenderly-project').toString(),
      tenderlyAccessKey: tenderlyCreds.secretValueFromJson('tenderly-access-key').toString(),
      tenderlyNodeApiKey: tenderlyCreds.secretValueFromJson('tenderly-node-api-key').toString(),
      unicornSecret: unicornSecrets.secretValueFromJson('debug-config-unicorn-key').toString(),
      alchemyQueryKey: alchemySubgraphSecret.secretValueFromJson('alchemy-query-key').toString(),
      alchemyQueryKey2: alchemySubgraphSecret.secretValueFromJson('alchemy-query-key-2').toString(),
      // bearer token and base subgraph id are not from alchemy subgraph, but from the graph
      // below secret namings are wrong, but we take it as is
      graphBearerToken: alchemySubgraphSecret.secretValueFromJson('alchemy-bearer-token').toString(),
      graphBaseV4SubgraphId: alchemySubgraphSecret.secretValueFromJson('alchemy-base-v4-subgraph-id').toString(),
      uniGraphQLEndpoint: routingApiNewSecrets.secretValueFromJson('uni-graphql-endpoint').toString(),
      uniGraphQLHeaderOrigin: routingApiNewSecrets.secretValueFromJson('uni-graphql-header-origin').toString(),
      goldskyBearerToken: routingApiNewSecrets.secretValueFromJson('GOLDSKY_BEARER_TOKEN').toString(),
      goldskyApiKey: routingApiNewSecrets.secretValueFromJson('GOLDSKY_API_KEY').toString(),
      // Goldsky V2 subgraph IDs
      goldskyEthereumV2Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_ETHEREUM_V2_ID').toString(),
      goldskyArbitrumV2Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_ARBITRUM_V2_ID').toString(),
      goldskyPolygonV2Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_POLYGON_V2_ID').toString(),
      goldskyOptimismV2Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_OPTIMISM_V2_ID').toString(),
      goldskyAvalancheV2Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_AVALANCHE_V2_ID').toString(),
      goldskyBnbV2Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_BNB_V2_ID').toString(),
      goldskyBlastV2Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_BLAST_V2_ID').toString(),
      goldskyBaseV2Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_BASE_V2_ID').toString(),
      goldskyWorldchainV2Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_WORLDCHAIN_V2_ID').toString(),
      goldskyAstrochainSepoliaV2Id: routingApiNewSecrets
        .secretValueFromJson('GOLD_SKY_ASTROCHAIN_SEPOLIA_V2_ID')
        .toString(),
      goldskyMonadTestnetV2Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_MONAD_TESTNET_V2_ID').toString(),
      goldskyUnichainV2Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_UNICHAIN_V2_ID').toString(),
      goldskySoneiumV2Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_SONEIUM_V2_ID').toString(),
      goldskyEthereumSepoliaV2Id: routingApiNewSecrets
        .secretValueFromJson('GOLD_SKY_ETHEREUM_SEPOLIA_V2_ID')
        .toString(),
      // Goldsky V3 subgraph IDs
      goldskyEthereumV3Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_ETHEREUM_V3_ID').toString(),
      goldskyArbitrumV3Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_ARBITRUM_V3_ID').toString(),
      goldskyPolygonV3Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_POLYGON_V3_ID').toString(),
      goldskyOptimismV3Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_OPTIMISM_V3_ID').toString(),
      goldskyAvalancheV3Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_AVALANCHE_V3_ID').toString(),
      goldskyBnbV3Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_BNB_V3_ID').toString(),
      goldskyBlastV3Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_BLAST_V3_ID').toString(),
      goldskyBaseV3Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_BASE_V3_ID').toString(),
      goldskyCeloV3Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_CELO_V3_ID').toString(),
      goldskyWorldchainV3Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_WORLDCHAIN_V3_ID').toString(),
      goldskyAstrochainSepoliaV3Id: routingApiNewSecrets
        .secretValueFromJson('GOLD_SKY_ASTROCHAIN_SEPOLIA_V3_ID')
        .toString(),
      goldskyUnichainV3Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_UNICHAIN_V3_ID').toString(),
      goldskyZoraV3Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_ZORA_V3_ID').toString(),
      goldskySoneiumV3Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_SONEIUM_V3_ID').toString(),
      // Goldsky V4 subgraph IDs
      goldskyEthereumSepoliaV4Id: routingApiNewSecrets
        .secretValueFromJson('GOLD_SKY_ETHEREUM_SEPOLIA_V4_ID')
        .toString(),
      goldskyArbitrumV4Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_ARBITRUM_V4_ID').toString(),
      goldskyBaseV4Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_BASE_V4_ID').toString(),
      goldskyPolygonV4Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_POLYGON_V4_ID').toString(),
      goldskyWorldchainV4Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_WORLDCHAIN_V4_ID').toString(),
      goldskyZoraV4Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_ZORA_V4_ID').toString(),
      goldskyUnichainV4Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_UNICHAIN_V4_ID').toString(),
      goldskyBnbV4Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_BNB_V4_ID').toString(),
      goldskyBlastV4Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_BLAST_V4_ID').toString(),
      goldskyEthereumV4Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_ETHEREUM_V4_ID').toString(),
      goldskySoneiumV4Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_SONEIUM_V4_ID').toString(),
      goldskyOptimismV4Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_OPTIMISM_V4_ID').toString(),
      goldskyCeloV4Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_CELO_V4_ID').toString(),
      goldskyAvalancheV4Id: routingApiNewSecrets.secretValueFromJson('GOLD_SKY_AVALANCHE_V4_ID').toString(),
    })

    const prodUsEast2AppStage = pipeline.addStage(prodUsEast2Stage)

    this.addIntegTests(code, prodUsEast2Stage, prodUsEast2AppStage, unicornSecret)

    const slackChannel = chatbot.SlackChannelConfiguration.fromSlackChannelConfigurationArn(
      this,
      'SlackChannel',
      'arn:aws:chatbot::644039819003:chat-configuration/slack-channel/eng-ops-slack-chatbot'
    )

    pipeline.buildPipeline()
    pipeline.pipeline.notifyOn('NotifySlack', slackChannel, {
      events: [PipelineNotificationEvents.PIPELINE_EXECUTION_FAILED],
    })
  }

  private addIntegTests(
    sourceArtifact: cdk.pipelines.CodePipelineSource,
    routingAPIStage: RoutingAPIStage,
    applicationStage: cdk.pipelines.StageDeployment,
    unicornSecret: string
  ) {
    const testAction = new CodeBuildStep(`IntegTests-${routingAPIStage.stageName}`, {
      projectName: `IntegTests-${routingAPIStage.stageName}`,
      input: sourceArtifact,
      envFromCfnOutputs: {
        UNISWAP_ROUTING_API: routingAPIStage.url,
      },
      buildEnvironment: {
        computeType: cdk.aws_codebuild.ComputeType.LARGE,
        environmentVariables: {
          NPM_TOKEN: {
            value: 'npm-private-repo-access-token',
            type: BuildEnvironmentVariableType.SECRETS_MANAGER,
          },
          ARCHIVE_NODE_RPC: {
            value: 'archive-node-rpc-url-default-kms',
            type: BuildEnvironmentVariableType.SECRETS_MANAGER,
          },
        },
      },
      commands: [
        'echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc && npm ci',
        'echo "UNISWAP_ROUTING_API=${UNISWAP_ROUTING_API}" > .env',
        'echo "ARCHIVE_NODE_RPC=${ARCHIVE_NODE_RPC}" >> .env',
        `echo "UNICORN_SECRET=${unicornSecret}" >> .env`,
        'npm install',
        'npm run build',
        'set NODE_OPTIONS=--max-old-space-size=16384 && npm run test:e2e',
      ],
    })

    applicationStage.addPost(testAction)
  }
}

const app = new cdk.App()

const jsonRpcProviders = {
  WEB3_RPC_1: process.env.WEB3_RPC_1!,
  WEB3_RPC_11155111: process.env.WEB3_RPC_11155111!,
  WEB3_RPC_44787: process.env.WEB3_RPC_44787!,
  WEB3_RPC_80001: process.env.WEB3_RPC_80001!,
  WEB3_RPC_81457: process.env.WEB3_RPC_81457!,
  WEB3_RPC_42161: process.env.WEB3_RPC_42161!,
  WEB3_RPC_421613: process.env.WEB3_RPC_421613!,
  WEB3_RPC_10: process.env.WEB3_RPC_10!,
  WEB3_RPC_137: process.env.WEB3_RPC_137!,
  WEB3_RPC_42220: process.env.WEB3_RPC_42220!,
  WEB3_RPC_43114: process.env.WEB3_RPC_43114!,
  WEB3_RPC_56: process.env.WEB3_RPC_56!,
  WEB3_RPC_8453: process.env.WEB3_RPC_8453!,
  WEB3_RPC_324: process.env.WEB3_RPC_324!,
  // The followings are for RPC Gateway
  // Optimism
  // INFURA_10: process.env.INFURA_10!,
  QUICKNODE_10: process.env.QUICKNODE_10!,
  ALCHEMY_10: process.env.ALCHEMY_10!,
  // Polygon
  QUICKNODE_137: process.env.QUICKNODE_137!,
  // INFURA_137: process.env.INFURA_137!,
  ALCHEMY_137: process.env.ALCHEMY_137!,
  // Celo
  QUICKNODE_42220: process.env.QUICKNODE_42220!,
  // INFURA_42220: process.env.INFURA_42220!,
  // Avalanche
  // INFURA_43114: process.env.INFURA_43114!,
  QUICKNODE_43114: process.env.QUICKNODE_43114!,
  // BNB
  QUICKNODE_56: process.env.QUICKNODE_56!,
  // Base
  QUICKNODE_8453: process.env.QUICKNODE_8453!,
  // INFURA_8453: process.env.INFURA_8453!,
  ALCHEMY_8453: process.env.ALCHEMY_8453!,
  // Sepolia
  // INFURA_11155111: process.env.INFURA_11155111!,
  ALCHEMY_11155111: process.env.ALCHEMY_11155111!,
  // Arbitrum
  // INFURA_42161: process.env.INFURA_42161!,
  QUICKNODE_42161: process.env.QUICKNODE_42161!,
  ALCHEMY_42161: process.env.ALCHEMY_42161!,
  // Ethereum
  // INFURA_1: process.env.INFURA_1!,
  QUICKNODE_1: process.env.QUICKNODE_1!,
  QUICKNODERETH_1: process.env.QUICKNODERETH_1!,
  ALCHEMY_1: process.env.ALCHEMY_1!,
  // Blast
  QUICKNODE_81457: process.env.QUICKNODE_81457!,
  // INFURA_81457: process.env.INFURA_81457!,
  // Zora
  QUICKNODE_7777777: process.env.QUICKNODE_7777777!,
  // ZkSync
  QUICKNODE_324: process.env.QUICKNODE_324!,
  ALCHEMY_324: process.env.ALCHEMY_324!,
  // WorldChain,
  QUICKNODE_480: process.env.QUICKNODE_480!,
  // Unichain Sepolia,
  QUICKNODE_1301: process.env.QUICKNODE_1301!,
  ALCHEMY_1301: process.env.ALCHEMY_1301!,
  // unirpc - serves all chains
  UNIRPC_0: process.env.UNIRPC_0!,
}

// Local dev stack
new RoutingAPIStack(app, 'RoutingAPIStack', {
  jsonRpcProviders: jsonRpcProviders,
  provisionedConcurrency: process.env.PROVISION_CONCURRENCY ? parseInt(process.env.PROVISION_CONCURRENCY) : 0,
  throttlingOverride: process.env.THROTTLE_PER_FIVE_MINS,
  ethGasStationInfoUrl: process.env.ETH_GAS_STATION_INFO_URL!,
  chatbotSNSArn: process.env.CHATBOT_SNS_ARN,
  stage: STAGE.LOCAL,
  internalApiKey: 'test-api-key',
  route53Arn: process.env.ROLE_ARN,
  pinata_key: process.env.PINATA_API_KEY!,
  pinata_secret: process.env.PINATA_API_SECRET!,
  hosted_zone: process.env.HOSTED_ZONE!,
  tenderlyUser: process.env.TENDERLY_USER!,
  tenderlyProject: process.env.TENDERLY_PROJECT!,
  tenderlyAccessKey: process.env.TENDERLY_ACCESS_KEY!,
  tenderlyNodeApiKey: process.env.TENDERLY_NODE_API_KEY!,
  unicornSecret: process.env.UNICORN_SECRET!,
  uniGraphQLEndpoint: process.env.GQL_URL!,
  uniGraphQLHeaderOrigin: process.env.GQL_H_ORGN!,
  alchemyQueryKey: process.env.ALCHEMY_QUERY_KEY!,
  alchemyQueryKey2: process.env.ALCHEMY_QUERY_KEY_2!,
  graphBaseV4SubgraphId: process.env.GRAPH_BASE_V4_SUBGRAPH_ID!,
  graphBearerToken: process.env.GRAPH_BEARER_TOKEN!,
  goldskyBearerToken: process.env.GOLDSKY_BEARER_TOKEN!,
  goldskyApiKey: process.env.GOLDSKY_API_KEY!,
  // Goldsky V2 subgraph IDs
  goldskyEthereumV2Id: process.env.GOLD_SKY_ETHEREUM_V2_ID!,
  goldskyArbitrumV2Id: process.env.GOLD_SKY_ARBITRUM_V2_ID!,
  goldskyPolygonV2Id: process.env.GOLD_SKY_POLYGON_V2_ID!,
  goldskyOptimismV2Id: process.env.GOLD_SKY_OPTIMISM_V2_ID!,
  goldskyAvalancheV2Id: process.env.GOLD_SKY_AVALANCHE_V2_ID!,
  goldskyBnbV2Id: process.env.GOLD_SKY_BNB_V2_ID!,
  goldskyBlastV2Id: process.env.GOLD_SKY_BLAST_V2_ID!,
  goldskyBaseV2Id: process.env.GOLD_SKY_BASE_V2_ID!,
  goldskyWorldchainV2Id: process.env.GOLD_SKY_WORLDCHAIN_V2_ID!,
  goldskyAstrochainSepoliaV2Id: process.env.GOLD_SKY_ASTROCHAIN_SEPOLIA_V2_ID!,
  goldskyMonadTestnetV2Id: process.env.GOLD_SKY_MONAD_TESTNET_V2_ID!,
  goldskyUnichainV2Id: process.env.GOLD_SKY_UNICHAIN_V2_ID!,
  goldskySoneiumV2Id: process.env.GOLD_SKY_SONEIUM_V2_ID!,
  goldskyEthereumSepoliaV2Id: process.env.GOLD_SKY_ETHEREUM_SEPOLIA_V2_ID!,
  // Goldsky V3 subgraph IDs
  goldskyEthereumV3Id: process.env.GOLD_SKY_ETHEREUM_V3_ID!,
  goldskyArbitrumV3Id: process.env.GOLD_SKY_ARBITRUM_V3_ID!,
  goldskyPolygonV3Id: process.env.GOLD_SKY_POLYGON_V3_ID!,
  goldskyOptimismV3Id: process.env.GOLD_SKY_OPTIMISM_V3_ID!,
  goldskyAvalancheV3Id: process.env.GOLD_SKY_AVALANCHE_V3_ID!,
  goldskyBnbV3Id: process.env.GOLD_SKY_BNB_V3_ID!,
  goldskyBlastV3Id: process.env.GOLD_SKY_BLAST_V3_ID!,
  goldskyBaseV3Id: process.env.GOLD_SKY_BASE_V3_ID!,
  goldskyCeloV3Id: process.env.GOLD_SKY_CELO_V3_ID!,
  goldskyWorldchainV3Id: process.env.GOLD_SKY_WORLDCHAIN_V3_ID!,
  goldskyAstrochainSepoliaV3Id: process.env.GOLD_SKY_ASTROCHAIN_SEPOLIA_V3_ID!,
  goldskyUnichainV3Id: process.env.GOLD_SKY_UNICHAIN_V3_ID!,
  goldskyZoraV3Id: process.env.GOLD_SKY_ZORA_V3_ID!,
  goldskySoneiumV3Id: process.env.GOLD_SKY_SONEIUM_V3_ID!,
  // Goldsky V4 subgraph IDs
  goldskyEthereumSepoliaV4Id: process.env.GOLD_SKY_ETHEREUM_SEPOLIA_V4_ID!,
  goldskyArbitrumV4Id: process.env.GOLD_SKY_ARBITRUM_V4_ID!,
  goldskyBaseV4Id: process.env.GOLD_SKY_BASE_V4_ID!,
  goldskyPolygonV4Id: process.env.GOLD_SKY_POLYGON_V4_ID!,
  goldskyWorldchainV4Id: process.env.GOLD_SKY_WORLDCHAIN_V4_ID!,
  goldskyZoraV4Id: process.env.GOLD_SKY_ZORA_V4_ID!,
  goldskyUnichainV4Id: process.env.GOLD_SKY_UNICHAIN_V4_ID!,
  goldskyBnbV4Id: process.env.GOLD_SKY_BNB_V4_ID!,
  goldskyBlastV4Id: process.env.GOLD_SKY_BLAST_V4_ID!,
  goldskyEthereumV4Id: process.env.GOLD_SKY_ETHEREUM_V4_ID!,
  goldskySoneiumV4Id: process.env.GOLD_SKY_SONEIUM_V4_ID!,
  goldskyOptimismV4Id: process.env.GOLD_SKY_OPTIMISM_V4_ID!,
  goldskyCeloV4Id: process.env.GOLD_SKY_CELO_V4_ID!,
  goldskyAvalancheV4Id: process.env.GOLD_SKY_AVALANCHE_V4_ID!,
})

new RoutingAPIPipeline(app, 'RoutingAPIPipelineStack', {
  env: { account: '644039819003', region: 'us-east-2' },
})
