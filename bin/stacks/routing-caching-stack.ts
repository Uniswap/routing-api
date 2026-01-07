import { Protocol } from '@uniswap/router-sdk'
import * as cdk from 'aws-cdk-lib'
import { Duration } from 'aws-cdk-lib'
import * as aws_cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import { MathExpression } from 'aws-cdk-lib/aws-cloudwatch'
import * as aws_cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions'
import * as aws_events from 'aws-cdk-lib/aws-events'
import * as aws_events_targets from 'aws-cdk-lib/aws-events-targets'
import * as aws_iam from 'aws-cdk-lib/aws-iam'
import { PolicyStatement } from 'aws-cdk-lib/aws-iam'
import * as aws_lambda from 'aws-cdk-lib/aws-lambda'
import * as aws_lambda_nodejs from 'aws-cdk-lib/aws-lambda-nodejs'
import * as aws_s3 from 'aws-cdk-lib/aws-s3'
import * as aws_sns from 'aws-cdk-lib/aws-sns'
import { Construct } from 'constructs'
import * as path from 'path'
import { chainProtocols } from '../../lib/cron/cache-config'
import { STAGE } from '../../lib/util/stage'
import { PoolCachingFilePrefixes } from '../../lib/util/poolCachingFilePrefixes'
import { ChainId } from '@uniswap/sdk-core'

export interface RoutingCachingStackProps extends cdk.NestedStackProps {
  stage: string
  route53Arn?: string
  pinata_key?: string
  pinata_secret?: string
  hosted_zone?: string
  chatbotSNSArn?: string
  alchemyQueryKey?: string
  alchemyQueryKey2?: string
  graphBaseV4SubgraphId?: string
  graphXlayerV4Id?: string
  graphXlayerV3Id?: string
  graphXLayerV2Id?: string
  graphBearerToken?: string
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

export class RoutingCachingStack extends cdk.NestedStack {
  public readonly poolCacheBucket: aws_s3.Bucket
  public readonly poolCacheBucket2: aws_s3.Bucket
  public readonly poolCacheBucket3: aws_s3.Bucket
  public readonly poolCacheKey: string
  public readonly poolCacheGzipKey: string
  public readonly tokenListCacheBucket: aws_s3.Bucket
  public readonly poolCacheLambdaNameArray: string[] = []
  public readonly alchemyQueryKey: string | undefined = undefined
  public readonly alchemyQueryKey2: string | undefined = undefined
  public readonly graphBaseV4SubgraphId: string | undefined = undefined
  public readonly graphXlayerV4Id: string | undefined = undefined
  public readonly graphXlayerV3Id: string | undefined = undefined
  public readonly graphXLayerV2Id: string | undefined = undefined
  public readonly graphBearerToken: string | undefined = undefined
  public readonly goldskyBearerToken: string | undefined = undefined
  public readonly goldskyApiKey: string | undefined = undefined
  // Goldsky V2 subgraph IDs
  public readonly goldskyEthereumV2Id: string | undefined = undefined
  public readonly goldskyArbitrumV2Id: string | undefined = undefined
  public readonly goldskyPolygonV2Id: string | undefined = undefined
  public readonly goldskyOptimismV2Id: string | undefined = undefined
  public readonly goldskyAvalancheV2Id: string | undefined = undefined
  public readonly goldskyBnbV2Id: string | undefined = undefined
  public readonly goldskyBlastV2Id: string | undefined = undefined
  public readonly goldskyBaseV2Id: string | undefined = undefined
  public readonly goldskyWorldchainV2Id: string | undefined = undefined
  public readonly goldskyAstrochainSepoliaV2Id: string | undefined = undefined
  public readonly goldskyMonadTestnetV2Id: string | undefined = undefined
  public readonly goldskyUnichainV2Id: string | undefined = undefined
  public readonly goldskySoneiumV2Id: string | undefined = undefined
  public readonly goldskyEthereumSepoliaV2Id: string | undefined = undefined
  // Goldsky V3 subgraph IDs
  public readonly goldskyEthereumV3Id: string | undefined = undefined
  public readonly goldskyArbitrumV3Id: string | undefined = undefined
  public readonly goldskyPolygonV3Id: string | undefined = undefined
  public readonly goldskyOptimismV3Id: string | undefined = undefined
  public readonly goldskyAvalancheV3Id: string | undefined = undefined
  public readonly goldskyBnbV3Id: string | undefined = undefined
  public readonly goldskyBlastV3Id: string | undefined = undefined
  public readonly goldskyBaseV3Id: string | undefined = undefined
  public readonly goldskyCeloV3Id: string | undefined = undefined
  public readonly goldskyWorldchainV3Id: string | undefined = undefined
  public readonly goldskyAstrochainSepoliaV3Id: string | undefined = undefined
  public readonly goldskyUnichainV3Id: string | undefined = undefined
  public readonly goldskyZoraV3Id: string | undefined = undefined
  public readonly goldskySoneiumV3Id: string | undefined = undefined
  // Goldsky V4 subgraph IDs
  public readonly goldskyEthereumSepoliaV4Id: string | undefined = undefined
  public readonly goldskyArbitrumV4Id: string | undefined = undefined
  public readonly goldskyBaseV4Id: string | undefined = undefined
  public readonly goldskyPolygonV4Id: string | undefined = undefined
  public readonly goldskyWorldchainV4Id: string | undefined = undefined
  public readonly goldskyZoraV4Id: string | undefined = undefined
  public readonly goldskyUnichainV4Id: string | undefined = undefined
  public readonly goldskyBnbV4Id: string | undefined = undefined
  public readonly goldskyBlastV4Id: string | undefined = undefined
  public readonly goldskyEthereumV4Id: string | undefined = undefined
  public readonly goldskySoneiumV4Id: string | undefined = undefined
  public readonly goldskyOptimismV4Id: string | undefined = undefined
  public readonly goldskyCeloV4Id: string | undefined = undefined
  public readonly goldskyAvalancheV4Id: string | undefined = undefined

  constructor(scope: Construct, name: string, props: RoutingCachingStackProps) {
    super(scope, name, props)

    const {
      chatbotSNSArn,
      alchemyQueryKey,
      alchemyQueryKey2,
      graphBaseV4SubgraphId,
      graphXlayerV4Id,
      graphXlayerV3Id,
      graphXLayerV2Id,
      graphBearerToken,
      goldskyApiKey,
      goldskyBearerToken,
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

    const chatBotTopic = chatbotSNSArn ? aws_sns.Topic.fromTopicArn(this, 'ChatbotTopic', chatbotSNSArn) : undefined

    this.alchemyQueryKey = alchemyQueryKey
    this.alchemyQueryKey2 = alchemyQueryKey2
    this.graphBaseV4SubgraphId = graphBaseV4SubgraphId
    this.graphXlayerV4Id = graphXlayerV4Id
    this.graphXlayerV3Id = graphXlayerV3Id
    this.graphXLayerV2Id = graphXLayerV2Id
    this.graphBearerToken = graphBearerToken
    this.goldskyApiKey = goldskyApiKey
    this.goldskyBearerToken = goldskyBearerToken
    // Goldsky V2 subgraph IDs
    this.goldskyEthereumV2Id = goldskyEthereumV2Id
    this.goldskyArbitrumV2Id = goldskyArbitrumV2Id
    this.goldskyPolygonV2Id = goldskyPolygonV2Id
    this.goldskyOptimismV2Id = goldskyOptimismV2Id
    this.goldskyAvalancheV2Id = goldskyAvalancheV2Id
    this.goldskyBnbV2Id = goldskyBnbV2Id
    this.goldskyBlastV2Id = goldskyBlastV2Id
    this.goldskyBaseV2Id = goldskyBaseV2Id
    this.goldskyWorldchainV2Id = goldskyWorldchainV2Id
    this.goldskyAstrochainSepoliaV2Id = goldskyAstrochainSepoliaV2Id
    this.goldskyMonadTestnetV2Id = goldskyMonadTestnetV2Id
    this.goldskyUnichainV2Id = goldskyUnichainV2Id
    this.goldskySoneiumV2Id = goldskySoneiumV2Id
    this.goldskyEthereumSepoliaV2Id = goldskyEthereumSepoliaV2Id
    // Goldsky V3 subgraph IDs
    this.goldskyEthereumV3Id = goldskyEthereumV3Id
    this.goldskyArbitrumV3Id = goldskyArbitrumV3Id
    this.goldskyPolygonV3Id = goldskyPolygonV3Id
    this.goldskyOptimismV3Id = goldskyOptimismV3Id
    this.goldskyAvalancheV3Id = goldskyAvalancheV3Id
    this.goldskyBnbV3Id = goldskyBnbV3Id
    this.goldskyBlastV3Id = goldskyBlastV3Id
    this.goldskyBaseV3Id = goldskyBaseV3Id
    this.goldskyCeloV3Id = goldskyCeloV3Id
    this.goldskyWorldchainV3Id = goldskyWorldchainV3Id
    this.goldskyAstrochainSepoliaV3Id = goldskyAstrochainSepoliaV3Id
    this.goldskyUnichainV3Id = goldskyUnichainV3Id
    this.goldskyZoraV3Id = goldskyZoraV3Id
    this.goldskySoneiumV3Id = goldskySoneiumV3Id
    // Goldsky V4 subgraph IDs
    this.goldskyEthereumSepoliaV4Id = goldskyEthereumSepoliaV4Id
    this.goldskyArbitrumV4Id = goldskyArbitrumV4Id
    this.goldskyBaseV4Id = goldskyBaseV4Id
    this.goldskyPolygonV4Id = goldskyPolygonV4Id
    this.goldskyWorldchainV4Id = goldskyWorldchainV4Id
    this.goldskyZoraV4Id = goldskyZoraV4Id
    this.goldskyUnichainV4Id = goldskyUnichainV4Id
    this.goldskyBnbV4Id = goldskyBnbV4Id
    this.goldskyBlastV4Id = goldskyBlastV4Id
    this.goldskyEthereumV4Id = goldskyEthereumV4Id
    this.goldskySoneiumV4Id = goldskySoneiumV4Id
    this.goldskyOptimismV4Id = goldskyOptimismV4Id
    this.goldskyCeloV4Id = goldskyCeloV4Id
    this.goldskyAvalancheV4Id = goldskyAvalancheV4Id
    // TODO: Remove and swap to the new bucket below. Kept around for the rollout, but all requests will go to bucket 2.
    this.poolCacheBucket = new aws_s3.Bucket(this, 'PoolCacheBucket')
    this.poolCacheBucket2 = new aws_s3.Bucket(this, 'PoolCacheBucket2')
    this.poolCacheBucket3 = new aws_s3.Bucket(this, 'PoolCacheBucket3')

    this.poolCacheBucket2.addLifecycleRule({
      enabled: true,
      // This isn't the right fix in the long run, but it will prevent the outage that we experienced when the V2 pool
      // data expired (See https://www.notion.so/uniswaplabs/Routing-API-Mainnet-outage-V2-Subgraph-11527aab3bd540888f92b33017bf26b4 for more detail).
      // The better short-term solution is to bake resilience into the V2SubgraphProvider (https://linear.app/uniswap/issue/ROUTE-31/use-v2-v3-fallback-provider-in-routing-api),
      // instrument the pool cache lambda, and take measures to improve its success rate.

      // Note that there is a trade-off here: we may serve stale V2 pools which can result in a suboptimal routing path if the file hasn't been recently updated.
      // This stale data is preferred to no-data until we can implement the above measures.

      // For now, choose an arbitrarily large TTL (in this case, 10 years) to prevent the key from being deleted.
      expiration: cdk.Duration.days(365 * 10),
    })

    this.poolCacheBucket3.addLifecycleRule({
      enabled: true,
      // See the comment above for the reasoning behind this TTL.
      expiration: cdk.Duration.days(365 * 10),
    })

    this.poolCacheKey = PoolCachingFilePrefixes.PlainText
    this.poolCacheGzipKey = PoolCachingFilePrefixes.GzipText

    const { stage, route53Arn } = props

    const lambdaRole = new aws_iam.Role(this, 'RoutingLambdaRole', {
      assumedBy: new aws_iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchFullAccess'),
      ],
    })

    if (stage == STAGE.BETA || stage == STAGE.PROD) {
      lambdaRole.addToPolicy(
        new PolicyStatement({
          resources: [route53Arn!],
          actions: ['sts:AssumeRole'],
          sid: '1',
        })
      )
    }

    const region = cdk.Stack.of(this).region

    const lambdaLayerVersion = aws_lambda.LayerVersion.fromLayerVersionArn(
      this,
      'InsightsLayerPools',
      `arn:aws:lambda:${region}:580247275435:layer:LambdaInsightsExtension:14`
    )

    // Spin up a new pool cache lambda for each config in chain X protocol
    for (let i = 0; i < chainProtocols.length; i++) {
      const { protocol, chainId, timeout } = chainProtocols[i]
      const lambda = new aws_lambda_nodejs.NodejsFunction(
        this,
        `PoolCacheLambda-ChainId${chainId}-Protocol${protocol}`,
        {
          role: lambdaRole,
          runtime: aws_lambda.Runtime.NODEJS_18_X,
          entry: path.join(__dirname, '../../lib/cron/cache-pools.ts'),
          handler: 'handler',
          timeout: Duration.seconds(900),
          memorySize: chainId === ChainId.BASE ? 5120 : 2560,
          bundling: {
            minify: true,
            sourceMap: true,
          },
          description: `Pool Cache Lambda for Chain with ChainId ${chainId} and Protocol ${protocol}`,
          layers: [lambdaLayerVersion],
          tracing: aws_lambda.Tracing.ACTIVE,
          environment: {
            VERSION: '5',
            POOL_CACHE_BUCKET: this.poolCacheBucket.bucketName,
            POOL_CACHE_BUCKET_3: this.poolCacheBucket3.bucketName,
            POOL_CACHE_GZIP_KEY: this.poolCacheGzipKey,
            ALCHEMY_QUERY_KEY: this.alchemyQueryKey ?? '',
            ALCHEMY_QUERY_KEY_2: this.alchemyQueryKey2 ?? '',
            GRAPH_BASE_V4_SUBGRAPH_ID: this.graphBaseV4SubgraphId ?? '',
            GRAPH_XLAYER_V4_SUBGRAPH_ID: this.graphXlayerV4Id ?? '',
            GRAPH_XLAYER_V3_SUBGRAPH_ID: this.graphXlayerV3Id ?? '',
            GRAPH_XLAYER_V2_SUBGRAPH_ID: this.graphXLayerV2Id ?? '',
            GRAPH_BEARER_TOKEN: this.graphBearerToken ?? '',
            GOLD_SKY_BEARER_TOKEN: this.goldskyBearerToken ?? '',
            GOLD_SKY_API_KEY: this.goldskyApiKey ?? '',
            // Goldsky V2 subgraph IDs
            GOLD_SKY_ETHEREUM_V2_ID: this.goldskyEthereumV2Id ?? '',
            GOLD_SKY_ARBITRUM_V2_ID: this.goldskyArbitrumV2Id ?? '',
            GOLD_SKY_POLYGON_V2_ID: this.goldskyPolygonV2Id ?? '',
            GOLD_SKY_OPTIMISM_V2_ID: this.goldskyOptimismV2Id ?? '',
            GOLD_SKY_AVALANCHE_V2_ID: this.goldskyAvalancheV2Id ?? '',
            GOLD_SKY_BNB_V2_ID: this.goldskyBnbV2Id ?? '',
            GOLD_SKY_BLAST_V2_ID: this.goldskyBlastV2Id ?? '',
            GOLD_SKY_BASE_V2_ID: this.goldskyBaseV2Id ?? '',
            GOLD_SKY_WORLDCHAIN_V2_ID: this.goldskyWorldchainV2Id ?? '',
            GOLD_SKY_ASTROCHAIN_SEPOLIA_V2_ID: this.goldskyAstrochainSepoliaV2Id ?? '',
            GOLD_SKY_MONAD_TESTNET_V2_ID: this.goldskyMonadTestnetV2Id ?? '',
            GOLD_SKY_UNICHAIN_V2_ID: this.goldskyUnichainV2Id ?? '',
            GOLD_SKY_SONEIUM_V2_ID: this.goldskySoneiumV2Id ?? '',
            GOLD_SKY_ETHEREUM_SEPOLIA_V2_ID: this.goldskyEthereumSepoliaV2Id ?? '',
            // Goldsky V3 subgraph IDs
            GOLD_SKY_ETHEREUM_V3_ID: this.goldskyEthereumV3Id ?? '',
            GOLD_SKY_ARBITRUM_V3_ID: this.goldskyArbitrumV3Id ?? '',
            GOLD_SKY_POLYGON_V3_ID: this.goldskyPolygonV3Id ?? '',
            GOLD_SKY_OPTIMISM_V3_ID: this.goldskyOptimismV3Id ?? '',
            GOLD_SKY_AVALANCHE_V3_ID: this.goldskyAvalancheV3Id ?? '',
            GOLD_SKY_BNB_V3_ID: this.goldskyBnbV3Id ?? '',
            GOLD_SKY_BLAST_V3_ID: this.goldskyBlastV3Id ?? '',
            GOLD_SKY_BASE_V3_ID: this.goldskyBaseV3Id ?? '',
            GOLD_SKY_CELO_V3_ID: this.goldskyCeloV3Id ?? '',
            GOLD_SKY_WORLDCHAIN_V3_ID: this.goldskyWorldchainV3Id ?? '',
            GOLD_SKY_ASTROCHAIN_SEPOLIA_V3_ID: this.goldskyAstrochainSepoliaV3Id ?? '',
            GOLD_SKY_UNICHAIN_V3_ID: this.goldskyUnichainV3Id ?? '',
            GOLD_SKY_ZORA_V3_ID: this.goldskyZoraV3Id ?? '',
            GOLD_SKY_SONEIUM_V3_ID: this.goldskySoneiumV3Id ?? '',
            // Goldsky V4 subgraph IDs
            GOLD_SKY_ETHEREUM_SEPOLIA_V4_ID: this.goldskyEthereumSepoliaV4Id ?? '',
            GOLD_SKY_ARBITRUM_V4_ID: this.goldskyArbitrumV4Id ?? '',
            GOLD_SKY_BASE_V4_ID: this.goldskyBaseV4Id ?? '',
            GOLD_SKY_POLYGON_V4_ID: this.goldskyPolygonV4Id ?? '',
            GOLD_SKY_WORLDCHAIN_V4_ID: this.goldskyWorldchainV4Id ?? '',
            GOLD_SKY_ZORA_V4_ID: this.goldskyZoraV4Id ?? '',
            GOLD_SKY_UNICHAIN_V4_ID: this.goldskyUnichainV4Id ?? '',
            GOLD_SKY_BNB_V4_ID: this.goldskyBnbV4Id ?? '',
            GOLD_SKY_BLAST_V4_ID: this.goldskyBlastV4Id ?? '',
            GOLD_SKY_ETHEREUM_V4_ID: this.goldskyEthereumV4Id ?? '',
            GOLD_SKY_SONEIUM_V4_ID: this.goldskySoneiumV4Id ?? '',
            GOLD_SKY_OPTIMISM_V4_ID: this.goldskyOptimismV4Id ?? '',
            GOLD_SKY_CELO_V4_ID: this.goldskyCeloV4Id ?? '',
            GOLD_SKY_AVALANCHE_V4_ID: this.goldskyAvalancheV4Id ?? '',
            chainId: chainId.toString(),
            protocol,
            timeout: timeout.toString(),
          },
        }
      )
      new aws_events.Rule(this, `SchedulePoolCache-ChainId${chainId}-Protocol${protocol}`, {
        schedule: aws_events.Schedule.rate(Duration.minutes(15)),
        targets: [new aws_events_targets.LambdaFunction(lambda)],
      })
      this.poolCacheBucket2.grantReadWrite(lambda)
      this.poolCacheBucket3.grantReadWrite(lambda)
      const lambdaAlarmErrorRate = new aws_cloudwatch.Alarm(
        this,
        `RoutingAPI-SEV4-PoolCacheToS3LambdaErrorRate-ChainId${chainId}-Protocol${protocol}`,
        {
          metric: new MathExpression({
            expression: '(invocations - errors) < 1',
            usingMetrics: {
              invocations: lambda.metricInvocations({
                period: Duration.minutes(60),
                statistic: 'sum',
              }),
              errors: lambda.metricErrors({
                period: Duration.minutes(60),
                statistic: 'sum',
              }),
            },
          }),
          threshold: protocol === Protocol.V3 ? 50 : 85,
          evaluationPeriods: protocol === Protocol.V3 ? 12 : 144,
        }
      )
      const lambdaThrottlesErrorRate = new aws_cloudwatch.Alarm(
        this,
        `RoutingAPI-PoolCacheToS3LambdaThrottles-ChainId${chainId}-Protocol${protocol}`,
        {
          metric: lambda.metricThrottles({
            period: Duration.minutes(5),
            statistic: 'sum',
          }),
          threshold: 5,
          evaluationPeriods: 1,
        }
      )
      if (chatBotTopic) {
        lambdaAlarmErrorRate.addAlarmAction(new aws_cloudwatch_actions.SnsAction(chatBotTopic))
        lambdaThrottlesErrorRate.addAlarmAction(new aws_cloudwatch_actions.SnsAction(chatBotTopic))
      }
      this.poolCacheLambdaNameArray.push(lambda.functionName)
    }

    this.tokenListCacheBucket = new aws_s3.Bucket(this, 'TokenListCacheBucket')

    const tokenListCachingLambda = new aws_lambda_nodejs.NodejsFunction(this, 'TokenListCacheLambda', {
      role: lambdaRole,
      runtime: aws_lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../../lib/cron/cache-token-lists.ts'),
      handler: 'handler',
      timeout: Duration.seconds(180),
      memorySize: 256,
      bundling: {
        minify: true,
        sourceMap: true,
      },
      layers: [
        aws_lambda.LayerVersion.fromLayerVersionArn(
          this,
          'InsightsLayerTokenList',
          `arn:aws:lambda:${region}:580247275435:layer:LambdaInsightsExtension:14`
        ),
      ],
      description: 'Token List Cache Lambda',
      tracing: aws_lambda.Tracing.ACTIVE,
      environment: {
        TOKEN_LIST_CACHE_BUCKET: this.tokenListCacheBucket.bucketName,
      },
    })

    this.tokenListCacheBucket.grantReadWrite(tokenListCachingLambda)

    new aws_events.Rule(this, 'ScheduleTokenListCache', {
      schedule: aws_events.Schedule.rate(Duration.minutes(15)),
      targets: [new aws_events_targets.LambdaFunction(tokenListCachingLambda)],
    })
  }
}
