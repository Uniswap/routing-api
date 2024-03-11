import { ChainId } from '@uniswap/sdk-core'
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
      unicornSecret: string
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
      unicornSecret,
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
      unicornSecret,
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

    // Load RPC provider URLs from AWS secret
    let jsonRpcProviders = {} as { [chainId: string]: string }
    SUPPORTED_CHAINS.forEach((chainId: ChainId) => {
      // TODO: Change this to `JSON_RPC_PROVIDER_${}` to be consistent with SOR
      const key = `WEB3_RPC_${chainId}`
      jsonRpcProviders[key] = jsonRpcProvidersSecret.secretValueFromJson(key).toString()
    })

    // Load RPC provider URLs from AWS secret (for RPC Gateway)
    const RPC_GATEWAY_PROVIDERS = [
      // Avalanche
      'WEB3_RPC_43114_INFURA',
      'WEB3_RPC_43114_NIRVANA',
      'WEB3_RPC_43114_QUICKNODE',
      // Optimism
      'WEB3_RPC_10_INFURA',
      'WEB3_RPC_10_NIRVANA',
      'WEB3_RPC_10_QUICKNODE',
      'WEB3_RPC_10_ALCHEMY',
    ]
    for (const provider of RPC_GATEWAY_PROVIDERS) {
      jsonRpcProviders[provider] = jsonRpcProvidersSecret.secretValueFromJson(provider).toString()
    }

    // Beta us-east-2
    const betaUsEast2Stage = new RoutingAPIStage(this, 'beta-us-east-2', {
      env: { account: '145079444317', region: 'us-east-2' },
      jsonRpcProviders: jsonRpcProviders,
      internalApiKey: internalApiKey.secretValue.toString(),
      provisionedConcurrency: 1,
      ethGasStationInfoUrl: ethGasStationInfoUrl.secretValue.toString(),
      stage: STAGE.BETA,
      route53Arn: route53Arn.secretValueFromJson('arn').toString(),
      pinata_key: pinataApi.secretValueFromJson('pinata-api-key').toString(),
      pinata_secret: pinataSecret.secretValueFromJson('secret').toString(),
      hosted_zone: hostedZone.secretValueFromJson('zone').toString(),
      tenderlyUser: tenderlyCreds.secretValueFromJson('tenderly-user').toString(),
      tenderlyProject: tenderlyCreds.secretValueFromJson('tenderly-project').toString(),
      tenderlyAccessKey: tenderlyCreds.secretValueFromJson('tenderly-access-key').toString(),
      unicornSecret: unicornSecrets.secretValueFromJson('debug-config-unicorn-key').toString(),
    })

    const betaUsEast2AppStage = pipeline.addStage(betaUsEast2Stage)

    this.addIntegTests(code, betaUsEast2Stage, betaUsEast2AppStage)

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
      unicornSecret: unicornSecrets.secretValueFromJson('debug-config-unicorn-key').toString(),
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
        'npm run test:e2e',
      ],
    })

    applicationStage.addPost(testAction)
  }
}

const app = new cdk.App()

const jsonRpcProviders = {
  WEB3_RPC_1: process.env.JSON_RPC_PROVIDER_1!,
  WEB3_RPC_3: process.env.JSON_RPC_PROVIDER_3!,
  WEB3_RPC_4: process.env.JSON_RPC_PROVIDER_4!,
  WEB3_RPC_5: process.env.JSON_RPC_PROVIDER_5!,
  WEB3_RPC_42: process.env.JSON_RPC_PROVIDER_42!,
  WEB3_RPC_10: process.env.JSON_RPC_PROVIDER_10!,
  WEB3_RPC_69: process.env.JSON_RPC_PROVIDER_69!,
  WEB3_RPC_42161: process.env.JSON_RPC_PROVIDER_42161!,
  WEB3_RPC_421611: process.env.JSON_RPC_PROVIDER_421611!,
  WEB3_RPC_11155111: process.env.JSON_RPC_PROVIDER_11155111!,
  WEB3_RPC_421613: process.env.JSON_RPC_PROVIDER_421613!,
  WEB3_RPC_137: process.env.JSON_RPC_PROVIDER_137!,
  WEB3_RPC_80001: process.env.JSON_RPC_PROVIDER_80001!,
  WEB3_RPC_42220: process.env.JSON_RPC_PROVIDER_42220!,
  WEB3_RPC_44787: process.env.JSON_RPC_PROVIDER_44787!,
  WEB3_RPC_56: process.env.JSON_RPC_PROVIDER_56!,
  WEB3_RPC_8453: process.env.JSON_RPC_PROVIDER_8453!,
  // Following is for RPC Gateway
  WEB3_RPC_43114_INFURA: process.env.WEB3_RPC_43114_INFURA!,
  WEB3_RPC_43114_NIRVANA: process.env.WEB3_RPC_43114_NIRVANA!,
  WEB3_RPC_43114_QUICKNODE: process.env.WEB3_RPC_43114_QUICKNODE!,
  WEB3_RPC_10_INFURA: process.env.WEB3_RPC_10_INFURA!,
  WEB3_RPC_10_NIRVANA: process.env.WEB3_RPC_10_NIRVANA!,
  WEB3_RPC_10_QUICKNODE: process.env.WEB3_RPC_10_QUICKNODE!,
  WEB3_RPC_10_ALCHEMY: process.env.WEB3_RPC_10_ALCHEMY!,
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
  unicornSecret: process.env.UNICORN_SECRET!,
})

new RoutingAPIPipeline(app, 'RoutingAPIPipelineStack', {
  env: { account: '644039819003', region: 'us-east-2' },
})
