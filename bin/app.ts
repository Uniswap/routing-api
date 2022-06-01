import { ChainId } from '@uniswap/smart-order-router'
import * as cdk from 'aws-cdk-lib'
import { CfnOutput, SecretValue, Stack, StackProps, Stage, StageProps } from 'aws-cdk-lib'
import * as chatbot from 'aws-cdk-lib/aws-chatbot'
import { BuildEnvironmentVariableType } from 'aws-cdk-lib/aws-codebuild'
import { PipelineNotificationEvents } from 'aws-cdk-lib/aws-codepipeline'
import * as sm from 'aws-cdk-lib/aws-secretsmanager'
import { CodeBuildStep, CodePipeline, CodePipelineSource } from 'aws-cdk-lib/pipelines'
import { Construct } from 'constructs'
import dotenv from 'dotenv'
import 'source-map-support/register'
import { STAGE } from '../lib/util/stage'
import { RoutingAPIStack } from './stacks/routing-api-stack'
dotenv.config()

export class RoutingAPIStage extends Stage {
  public readonly url: CfnOutput

  constructor(
    scope: Construct,
    id: string,
    props: StageProps & {
      jsonRpcProvider: string
      jsonRpcProviderOverride: Map<ChainId, string>
      provisionedConcurrency: number
      ethGasStationInfoUrl: string
      chatbotSNSArn?: string
      stage: string
      route53Arn?: string
      pinata_key?: string
      pinata_secret?: string
      hosted_zone?: string
    }
  ) {
    super(scope, id, props)
    const {
      jsonRpcProvider,
      jsonRpcProviderOverride,
      provisionedConcurrency,
      ethGasStationInfoUrl,
      chatbotSNSArn,
      stage,
      route53Arn,
      pinata_key,
      pinata_secret,
      hosted_zone,
    } = props

    const { url } = new RoutingAPIStack(this, 'RoutingAPI', {
      jsonRpcProvider,
      jsonRpcProviderOverride,
      provisionedConcurrency,
      ethGasStationInfoUrl,
      chatbotSNSArn,
      stage,
      route53Arn,
      pinata_key,
      pinata_secret,
      hosted_zone,
    })
    this.url = url
  }
}

export class RoutingAPIPipeline extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    const code = CodePipelineSource.gitHub('Uniswap/routing-api', 'main', {
      authentication: SecretValue.secretsManager('github-token-2'),
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

    const jsonRpcProvider = sm.Secret.fromSecretAttributes(this, 'jsonRpcProvider', {
      secretCompleteArn: 'arn:aws:secretsmanager:us-east-2:644039819003:secret:jsonRpcProvider-UlSwK2',
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

    // Beta us-east-2
    const betaUsEast2Stage = new RoutingAPIStage(this, 'beta-us-east-2', {
      env: { account: '145079444317', region: 'us-east-2' },
      jsonRpcProvider: jsonRpcProvider.secretValue.toString(),
      jsonRpcProviderOverride: new Map<ChainId, string>(),
      provisionedConcurrency: 20,
      ethGasStationInfoUrl: ethGasStationInfoUrl.secretValue.toString(),
      stage: STAGE.BETA,
      route53Arn: route53Arn.secretValueFromJson('arn').toString(),
      pinata_key: pinataApi.secretValueFromJson('pinata-api-key').toString(),
      pinata_secret: pinataSecret.secretValueFromJson('secret').toString(),
      hosted_zone: hostedZone.secretValueFromJson('zone').toString(),
    })

    const betaUsEast2AppStage = pipeline.addStage(betaUsEast2Stage)

    this.addIntegTests(code, betaUsEast2Stage, betaUsEast2AppStage)

    // Prod us-east-2
    const prodUsEast2Stage = new RoutingAPIStage(this, 'prod-us-east-2', {
      env: { account: '606857263320', region: 'us-east-2' },
      jsonRpcProvider: jsonRpcProvider.secretValue.toString(),
      jsonRpcProviderOverride: new Map<ChainId, string>(),
      provisionedConcurrency: 100,
      ethGasStationInfoUrl: ethGasStationInfoUrl.secretValue.toString(),
      chatbotSNSArn: 'arn:aws:sns:us-east-2:644039819003:SlackChatbotTopic',
      stage: STAGE.PROD,
      route53Arn: route53Arn.secretValueFromJson('arn').toString(),
      pinata_key: pinataApi.secretValueFromJson('pinata-api-key').toString(),
      pinata_secret: pinataSecret.secretValueFromJson('secret').toString(),
      hosted_zone: hostedZone.secretValueFromJson('zone').toString(),
    })

    const prodUsEast2AppStage = pipeline.addStage(prodUsEast2Stage)

    this.addIntegTests(code, prodUsEast2Stage, prodUsEast2AppStage)

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
    applicationStage: cdk.pipelines.StageDeployment
  ) {
    const testAction = new CodeBuildStep(`IntegTests-${routingAPIStage.stageName}`, {
      projectName: `IntegTests-${routingAPIStage.stageName}`,
      input: sourceArtifact,
      envFromCfnOutputs: {
        UNISWAP_ROUTING_API: routingAPIStage.url,
      },
      buildEnvironment: {
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
        'npm install',
        'npm run build',
        'npm run integ-test',
      ],
    })

    applicationStage.addPost(testAction)
  }
}

const app = new cdk.App()

// Local dev stack
new RoutingAPIStack(app, 'RoutingAPIStack', {
  jsonRpcProvider: process.env.JSON_RPC_PROVIDER!,
  jsonRpcProviderOverride: new Map<ChainId, string>(),
  provisionedConcurrency: process.env.PROVISION_CONCURRENCY ? parseInt(process.env.PROVISION_CONCURRENCY) : 0,
  throttlingOverride: process.env.THROTTLE_PER_FIVE_MINS,
  ethGasStationInfoUrl: process.env.ETH_GAS_STATION_INFO_URL!,
  chatbotSNSArn: process.env.CHATBOT_SNS_ARN,
  stage: STAGE.LOCAL,
  route53Arn: process.env.ROLE_ARN,
  pinata_key: process.env.PINATA_API_KEY!,
  pinata_secret: process.env.PINATA_API_SECRET!,
  hosted_zone: process.env.HOSTED_ZONE!,
})

new RoutingAPIPipeline(app, 'RoutingAPIPipelineStack', {
  env: { account: '644039819003', region: 'us-east-2' },
})
