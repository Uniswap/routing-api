import * as chatbot from '@aws-cdk/aws-chatbot';
import { BuildEnvironmentVariableType } from '@aws-cdk/aws-codebuild';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import { PipelineNotificationEvents } from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions';
import * as sm from '@aws-cdk/aws-secretsmanager';
import * as cdk from '@aws-cdk/core';
import {
  CfnOutput,
  Construct,
  SecretValue,
  Stack,
  StackProps,
  Stage,
  StageProps,
} from '@aws-cdk/core';
import {
  CdkPipeline,
  CdkStage,
  ShellScriptAction,
  SimpleSynthAction,
} from '@aws-cdk/pipelines';
import dotenv from 'dotenv';
import 'source-map-support/register';
import { RoutingAPIStack } from './stacks/routing-api-stack';
dotenv.config();

export enum STAGE {
  BETA = 'beta',
  PROD = 'prod',
  LOCAL = 'local',
}

export class RoutingAPIStage extends Stage {
  public readonly url: CfnOutput;

  constructor(
    scope: Construct,
    id: string,
    props: StageProps & {
      nodeRPC: string;
      nodeRPCUsername: string;
      nodeRPCPassword: string;
      nodeRPCRinkeby: string;
      nodeRPCUsernameRinkeby: string;
      nodeRPCPasswordRinkeby: string;
      provisionedConcurrency: number;
      ethGasStationInfoUrl: string;
      chatbotSNSArn?: string;
      stage: string;
      route53Arn?: string;
      pinata_key?: string;
      pinata_secret?: string;
      hosted_zone?: string;
    }
  ) {
    super(scope, id, props);
    const {
      nodeRPC,
      nodeRPCUsername,
      nodeRPCPassword,
      nodeRPCRinkeby,
      nodeRPCUsernameRinkeby,
      nodeRPCPasswordRinkeby,
      provisionedConcurrency,
      ethGasStationInfoUrl,
      chatbotSNSArn,
      stage,
      route53Arn,
      pinata_key,
      pinata_secret,
      hosted_zone,
    } = props;

    const { url } = new RoutingAPIStack(this, 'RoutingAPI', {
      nodeRPC,
      nodeRPCUsername,
      nodeRPCPassword,
      nodeRPCRinkeby,
      nodeRPCUsernameRinkeby,
      nodeRPCPasswordRinkeby,
      provisionedConcurrency,
      ethGasStationInfoUrl,
      chatbotSNSArn,
      stage,
      route53Arn,
      pinata_key,
      pinata_secret,
      hosted_zone,
    });
    this.url = url;
  }
}

export class RoutingAPIPipeline extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const sourceArtifact = new codepipeline.Artifact();
    const cloudAssemblyArtifact = new codepipeline.Artifact();

    const pipeline = new CdkPipeline(this, 'RoutingAPIPipeline', {
      // The pipeline name
      pipelineName: 'RoutingAPI',
      cloudAssemblyArtifact,

      // Where the source can be found
      sourceAction: new codepipeline_actions.GitHubSourceAction({
        actionName: 'GitHub',
        output: sourceArtifact,
        oauthToken: SecretValue.secretsManager('github-token-2'),
        owner: 'Uniswap',
        repo: 'routing-api',
        branch: 'main',
      }),

      // Build, Unit Test, and Synth templates.
      synthAction: SimpleSynthAction.standardNpmSynth({
        sourceArtifact,
        cloudAssemblyArtifact,
        environmentVariables: {
          NPM_TOKEN: {
            value: 'npm-private-repo-access-token',
            type: BuildEnvironmentVariableType.SECRETS_MANAGER,
          },
        },
        installCommand:
          'echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc && npm ci',
        buildCommand: 'npm run build',
        testCommands: ['npm run test'],
      }),
    });

    // Secrets are stored in secrets manager in the pipeline account. Accounts we deploy to
    // have been granted permissions to access secrets via resource policies.
    const rpcNodeDetails = sm.Secret.fromSecretAttributes(this, 'RPCNodeUrl', {
      secretCompleteArn:
        'arn:aws:secretsmanager:us-east-2:644039819003:secret:routing-api-infura-rpc-url-json-3ifNy7',
    });

    const rpcNodeDetailsRinkeby = sm.Secret.fromSecretAttributes(
      this,
      'RPCNodeUrlRinkeby',
      {
        secretCompleteArn:
          'arn:aws:secretsmanager:us-east-2:644039819003:secret:routing-api-infura-rpc-url-rinkeby-json-ZBo7kp',
      }
    );

    const ethGasStationInfoUrl = sm.Secret.fromSecretAttributes(
      this,
      'ETHGasStationUrl',
      {
        secretCompleteArn:
          'arn:aws:secretsmanager:us-east-2:644039819003:secret:eth-gas-station-info-url-ulGncX',
      }
    );

    const pinataApi = sm.Secret.fromSecretAttributes(this, 'PinataAPI', {
      secretCompleteArn:
        'arn:aws:secretsmanager:us-east-2:644039819003:secret:pinata-api-key-UVLAfM',
    });
    const route53Arn = sm.Secret.fromSecretAttributes(this, 'Route53Arn', {
      secretCompleteArn:
        'arn:aws:secretsmanager:us-east-2:644039819003:secret:Route53Arn-elRmmw',
    });

    const pinataSecret = sm.Secret.fromSecretAttributes(this, 'PinataSecret', {
      secretCompleteArn:
        'arn:aws:secretsmanager:us-east-2:644039819003:secret:pinata-secret-svGaPt',
    });

    const hostedZone = sm.Secret.fromSecretAttributes(this, 'HostedZone', {
      secretCompleteArn:
        'arn:aws:secretsmanager:us-east-2:644039819003:secret:hosted-zone-JmPDNV',
    });

    // Beta us-east-2
    const betaUsEast2Stage = new RoutingAPIStage(this, 'beta-us-east-2', {
      env: { account: '145079444317', region: 'us-east-2' },
      nodeRPC: rpcNodeDetails.secretValueFromJson('url').toString(),
      nodeRPCUsername: rpcNodeDetails
        .secretValueFromJson('username')
        .toString(),
      nodeRPCPassword: rpcNodeDetails
        .secretValueFromJson('password')
        .toString(),
      nodeRPCRinkeby: rpcNodeDetailsRinkeby
        .secretValueFromJson('url')
        .toString(),
      nodeRPCUsernameRinkeby: rpcNodeDetailsRinkeby
        .secretValueFromJson('username')
        .toString(),
      nodeRPCPasswordRinkeby: rpcNodeDetailsRinkeby
        .secretValueFromJson('password')
        .toString(),
      provisionedConcurrency: 20,
      ethGasStationInfoUrl: ethGasStationInfoUrl.secretValue.toString(),
      chatbotSNSArn: 'arn:aws:sns:us-east-2:644039819003:SlackChatbotTopic',
      stage: STAGE.BETA,
      route53Arn: route53Arn.secretValueFromJson('arn').toString(),
      pinata_key: pinataApi.secretValueFromJson('pinata-api-key').toString(),
      pinata_secret: pinataSecret.secretValueFromJson('secret').toString(),
      hosted_zone: hostedZone.secretValueFromJson('zone').toString(),
    });

    const betaUsEast2AppStage = pipeline.addApplicationStage(betaUsEast2Stage);

    this.addIntegTests(
      pipeline,
      sourceArtifact,
      betaUsEast2Stage,
      betaUsEast2AppStage
    );

    // Prod us-east-2
    const prodUsEast2Stage = new RoutingAPIStage(this, 'prod-us-east-2', {
      env: { account: '606857263320', region: 'us-east-2' },
      nodeRPC: rpcNodeDetails.secretValueFromJson('url').toString(),
      nodeRPCUsername: rpcNodeDetails
        .secretValueFromJson('username')
        .toString(),
      nodeRPCPassword: rpcNodeDetails
        .secretValueFromJson('password')
        .toString(),
      nodeRPCRinkeby: rpcNodeDetailsRinkeby
        .secretValueFromJson('url')
        .toString(),
      nodeRPCUsernameRinkeby: rpcNodeDetailsRinkeby
        .secretValueFromJson('username')
        .toString(),
      nodeRPCPasswordRinkeby: rpcNodeDetailsRinkeby
        .secretValueFromJson('password')
        .toString(),
      provisionedConcurrency: 100,
      ethGasStationInfoUrl: ethGasStationInfoUrl.secretValue.toString(),
      chatbotSNSArn: 'arn:aws:sns:us-east-2:644039819003:SlackChatbotTopic',
      stage: STAGE.PROD,
      route53Arn: route53Arn.secretValueFromJson('arn').toString(),
      pinata_key: pinataApi.secretValueFromJson('pinata-api-key').toString(),
      pinata_secret: pinataSecret.secretValueFromJson('secret').toString(),
      hosted_zone: hostedZone.secretValueFromJson('zone').toString(),
    });

    const prodUsEast2AppStage = pipeline.addApplicationStage(prodUsEast2Stage);

    this.addIntegTests(
      pipeline,
      sourceArtifact,
      prodUsEast2Stage,
      prodUsEast2AppStage
    );

    const slackChannel =
      chatbot.SlackChannelConfiguration.fromSlackChannelConfigurationArn(
        this,
        'SlackChannel',
        'arn:aws:chatbot::644039819003:chat-configuration/slack-channel/eng-ops-slack-chatbot'
      );

    pipeline.codePipeline.notifyOn('NotifySlack', slackChannel, {
      events: [PipelineNotificationEvents.PIPELINE_EXECUTION_FAILED],
    });
  }

  private addIntegTests(
    pipeline: CdkPipeline,
    sourceArtifact: codepipeline.Artifact,
    routingAPIStage: RoutingAPIStage,
    applicationStage: CdkStage
  ) {
    const testAction = new ShellScriptAction({
      actionName: `IntegTests-${routingAPIStage.stageName}`,
      additionalArtifacts: [sourceArtifact],
      useOutputs: {
        UNISWAP_ROUTING_API: pipeline.stackOutput(routingAPIStage.url),
      },
      environmentVariables: {
        NPM_TOKEN: {
          value: 'npm-private-repo-access-token',
          type: BuildEnvironmentVariableType.SECRETS_MANAGER,
        },
      },
      commands: [
        'echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc && npm ci',
        'echo "UNISWAP_ROUTING_API=${UNISWAP_ROUTING_API}" > .env',
        'npm install',
        'npm run integ-test',
      ],
      runOrder: applicationStage.nextSequentialRunOrder(),
    });

    applicationStage.addActions(testAction);
  }
}

const app = new cdk.App();

// Local dev stack
new RoutingAPIStack(app, 'RoutingAPIStack', {
  nodeRPC: process.env.JSON_RPC_URL!,
  nodeRPCUsername: process.env.JSON_RPC_USERNAME!,
  nodeRPCPassword: process.env.JSON_RPC_PASSWORD!,
  nodeRPCRinkeby: process.env.JSON_RPC_URL_RINKEBY!,
  nodeRPCUsernameRinkeby: process.env.JSON_RPC_USERNAME_RINKEBY!,
  nodeRPCPasswordRinkeby: process.env.JSON_RPC_PASSWORD_RINKEBY!,
  provisionedConcurrency: process.env.PROVISION_CONCURRENCY
    ? parseInt(process.env.PROVISION_CONCURRENCY)
    : 0,
  throttlingOverride: process.env.THROTTLE_PER_FIVE_MINS,
  ethGasStationInfoUrl: process.env.ETH_GAS_STATION_INFO_URL!,
  chatbotSNSArn: process.env.CHATBOT_SNS_ARN,
  stage: STAGE.LOCAL,
  route53Arn: process.env.ROLE_ARN,
  pinata_key: process.env.PINATA_API_KEY!,
  pinata_secret: process.env.PINATA_API_SECRET!,
  hosted_zone: process.env.HOSTED_ZONE!,
});

new RoutingAPIPipeline(app, 'RoutingAPIPipelineStack', {
  env: { account: '644039819003', region: 'us-east-2' },
});
