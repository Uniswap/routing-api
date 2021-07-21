#!/usr/bin/env node
import { BuildEnvironmentVariableType } from '@aws-cdk/aws-codebuild';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
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

export class RoutingAPIStage extends Stage {
  public readonly url: CfnOutput;

  constructor(
    scope: Construct,
    id: string,
    props: StageProps & {
      nodeRPC: string;
      nodeRPCUsername: string;
      nodeRPCPassword: string;
      provisionedConcurrency: number;
    }
  ) {
    super(scope, id, props);
    const {
      nodeRPC,
      nodeRPCUsername,
      nodeRPCPassword,
      provisionedConcurrency,
    } = props;

    const { url } = new RoutingAPIStack(this, 'RoutingAPI', {
      nodeRPC,
      nodeRPCUsername,
      nodeRPCPassword,
      provisionedConcurrency,
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
        repo: 'uniswap-routing-api',
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
      provisionedConcurrency: 20,
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
      provisionedConcurrency: 20,
    });

    const prodUsEast2AppStage = pipeline.addApplicationStage(prodUsEast2Stage);

    this.addIntegTests(
      pipeline,
      sourceArtifact,
      prodUsEast2Stage,
      prodUsEast2AppStage
    );
  }

  private addIntegTests(
    pipeline: CdkPipeline,
    sourceArtifact: codepipeline.Artifact,
    routingAPIStage: RoutingAPIStage,
    applicationStage: CdkStage
  ) {
    applicationStage.addActions(
      new ShellScriptAction({
        actionName: 'IntegrationTests',
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
      })
    );
  }
}

const app = new cdk.App();

// Local dev stack
new RoutingAPIStack(app, 'RoutingAPIStack', {
  nodeRPC: process.env.JSON_RPC_URL!,
  nodeRPCUsername: process.env.JSON_RPC_USERNAME!,
  nodeRPCPassword: process.env.JSON_RPC_PASSWORD!,
  provisionedConcurrency: process.env.PROVISION_CONCURRENCY
    ? parseInt(process.env.PROVISION_CONCURRENCY)
    : 0,
  throttlingOverride: process.env.THROTTLE_PER_FIVE_MINS,
});

new RoutingAPIPipeline(app, 'RoutingAPIPipelineStack', {
  env: { account: '644039819003', region: 'us-east-2' },
});
