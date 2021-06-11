#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { RoutingAPIStack } from './stacks/routing-api-stack';

const app = new cdk.App();
new RoutingAPIStack(app, 'RoutingAPIStack');
