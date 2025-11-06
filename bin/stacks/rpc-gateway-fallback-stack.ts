import * as cdk from 'aws-cdk-lib'
import { aws_iam, aws_lambda, aws_lambda_nodejs } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import path from 'path'
import { RetentionDays } from 'aws-cdk-lib/aws-logs'
import { DynamoDBTableProps } from './routing-database-stack'
import * as aws_dynamodb from 'aws-cdk-lib/aws-dynamodb'

export interface RpcGatewayFallbackStackPros extends cdk.NestedStackProps {
  rpcProviderHealthStateDynamoDb: aws_dynamodb.Table
}

export class RpcGatewayFallbackStack extends cdk.NestedStack {
  constructor(scope: Construct, name: string, props: RpcGatewayFallbackStackPros) {
    super(scope, name, props)

    const lambdaRole = new aws_iam.Role(this, 'ProviderFallbackLambdaRole', {
      assumedBy: new aws_iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaRole'),
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchLambdaInsightsExecutionRolePolicy'),
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess'),
      ],
    })

    const rpcHealthProviderStateDynamoDB = props.rpcProviderHealthStateDynamoDb
    rpcHealthProviderStateDynamoDB.grantReadWriteData(lambdaRole)

    const region = cdk.Stack.of(this).region

    new aws_lambda_nodejs.NodejsFunction(this, 'ProviderFallbackLambda', {
      role: lambdaRole,
      runtime: aws_lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../../lib/rpc/handler/index.ts'),
      handler: 'fallbackHandler',
      timeout: cdk.Duration.seconds(15),
      memorySize: 1024,
      description: 'Provider Fallback Lambda',
      bundling: {
        minify: true,
        sourceMap: true,
      },
      layers: [
        aws_lambda.LayerVersion.fromLayerVersionArn(
          this,
          'InsightsLayer',
          `arn:aws:lambda:${region}:580247275435:layer:LambdaInsightsExtension:14`
        ),
      ],
      tracing: aws_lambda.Tracing.ACTIVE,
      logRetention: RetentionDays.ONE_WEEK,

      environment: {
        PROVIDER_HEALTH_STATE_DB_TABLE_NAME: DynamoDBTableProps.RpcProviderHealthStateDbTable.Name,
      },
    })
  }
}
