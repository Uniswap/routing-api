import * as cdk from 'aws-cdk-lib'
import * as asg from 'aws-cdk-lib/aws-applicationautoscaling'
import * as aws_iam from 'aws-cdk-lib/aws-iam'
import * as aws_lambda from 'aws-cdk-lib/aws-lambda'
import * as aws_lambda_nodejs from 'aws-cdk-lib/aws-lambda-nodejs'
import { Construct } from 'constructs'
import * as path from 'path'
import { DynamoDBTableProps } from './routing-database-stack'
import { RetentionDays } from 'aws-cdk-lib/aws-logs'

export interface SecondaryRoutingLambdaStackProps extends cdk.NestedStackProps {
  provisionedConcurrency: number
}
export class SecondaryRoutingLambdaStack extends cdk.NestedStack {
  public readonly secondaryRoutingLambda: aws_lambda_nodejs.NodejsFunction
  public readonly secondaryRoutingLambdaAlias: aws_lambda.Alias

  constructor(scope: Construct, name: string, props: SecondaryRoutingLambdaStackProps) {
    super(scope, name, props)
    const { provisionedConcurrency } = props

    const lambdaRole = new aws_iam.Role(this, 'SecondaryRoutingLambdaRole', {
      assumedBy: new aws_iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchLambdaInsightsExecutionRolePolicy'),
      ],
    })
    const region = cdk.Stack.of(this).region

    this.secondaryRoutingLambda = new aws_lambda_nodejs.NodejsFunction(this, 'SecondaryRoutingLambda2', {
      role: lambdaRole,
      runtime: aws_lambda.Runtime.NODEJS_14_X,
      entry: path.join(__dirname, '../../lib/handlers/index.ts'),
      handler: 'testHandler',
      timeout: cdk.Duration.seconds(29),
      memorySize: 1024,
      bundling: {
        minify: true,
        sourceMap: true,
      },
      description: 'Secondary Routing Lambda',
      environment: {
        VERSION: '5',
        NODE_OPTIONS: '--enable-source-maps',
        CACHED_ROUTES_TABLE_NAME: DynamoDBTableProps.CacheRouteDynamoDbTable.Name,
        CACHED_V3_POOLS_TABLE_NAME: DynamoDBTableProps.V3PoolsDynamoDbTable.Name,
      },
      layers: [
        aws_lambda.LayerVersion.fromLayerVersionArn(
          this,
          'InsightsLayer',
          `arn:aws:lambda:${region}:580247275435:layer:LambdaInsightsExtension:14`
        ),
      ],
      tracing: aws_lambda.Tracing.ACTIVE,
      logRetention: RetentionDays.TWO_WEEKS,
    })

    const enableProvisionedConcurrency = provisionedConcurrency > 0

    this.secondaryRoutingLambdaAlias = new aws_lambda.Alias(this, 'RoutingLiveAlias', {
      aliasName: 'live',
      version: this.secondaryRoutingLambda.currentVersion,
      provisionedConcurrentExecutions: enableProvisionedConcurrency ? provisionedConcurrency : undefined,
    })

    if (enableProvisionedConcurrency) {
      const target = new asg.ScalableTarget(this, 'RoutingProvConcASG', {
        serviceNamespace: asg.ServiceNamespace.LAMBDA,
        maxCapacity: provisionedConcurrency * 5,
        minCapacity: provisionedConcurrency,
        resourceId: `function:${this.secondaryRoutingLambdaAlias.lambda.functionName}:${this.secondaryRoutingLambdaAlias.aliasName}`,
        scalableDimension: 'lambda:function:ProvisionedConcurrency',
      })

      target.node.addDependency(this.secondaryRoutingLambdaAlias)

      target.scaleToTrackMetric('RoutingProvConcTracking', {
        targetValue: 0.8,
        predefinedMetric: asg.PredefinedMetric.LAMBDA_PROVISIONED_CONCURRENCY_UTILIZATION,
      })
    }
  }
}
