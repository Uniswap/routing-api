import * as cdk from 'aws-cdk-lib'
import * as aws_dynamodb from 'aws-cdk-lib/aws-dynamodb'
import { AttributeType, BillingMode } from 'aws-cdk-lib/aws-dynamodb'
import { Construct } from 'constructs'

export interface RoutingDatabaseStackProps extends cdk.NestedStackProps {}

export class RoutingDatabaseStack extends cdk.NestedStack {
  public readonly cachedRoutesDynamoDb: aws_dynamodb.Table

  constructor(scope: Construct, name: string, props: RoutingDatabaseStackProps) {
    super(scope, name, props)

    this.cachedRoutesDynamoDb = new aws_dynamodb.Table(this, 'RouteCachingDB', {
      partitionKey: { name: 'pairTradeTypeChainId', type: AttributeType.STRING },
      sortKey: { name: 'protocolsAmountBlockNumber', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl'
    });
  }
}
