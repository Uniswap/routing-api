import * as cdk from 'aws-cdk-lib'
import * as aws_dynamodb from 'aws-cdk-lib/aws-dynamodb'
import { AttributeType, BillingMode } from 'aws-cdk-lib/aws-dynamodb'
import { Construct } from 'constructs'

export interface RoutingDatabaseStackProps extends cdk.NestedStackProps {}

export const V3PoolsDynamoDbPartitionKeyName = 'poolAddress'
export const V3PoolsDynamoDbSortKeyName = 'blockNumber'

export const TTLAttributeName = 'ttl'

export const V3PoolsDynamoDbProps: aws_dynamodb.TableProps = {
  tableName: 'V3PoolsCachingDB',
  partitionKey: { name: V3PoolsDynamoDbPartitionKeyName, type: AttributeType.STRING },
  sortKey: { name: V3PoolsDynamoDbSortKeyName, type: AttributeType.STRING },
  billingMode: BillingMode.PAY_PER_REQUEST,
  timeToLiveAttribute: TTLAttributeName,
}

export class RoutingDatabaseStack extends cdk.NestedStack {
  public readonly cachedRoutesDynamoDb: aws_dynamodb.Table
  public readonly cachedV3PoolsDynamoDb: aws_dynamodb.Table

  constructor(scope: Construct, name: string, props: RoutingDatabaseStackProps) {
    super(scope, name, props)

    // Creates a DynamoDB Table for storing the cached routes
    this.cachedRoutesDynamoDb = new aws_dynamodb.Table(this, 'RouteCachingDB', {
      tableName: 'RouteCachingDB',
      partitionKey: { name: 'pairTradeTypeChainId', type: AttributeType.STRING },
      sortKey: { name: 'protocolsBucketBlockNumber', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: TTLAttributeName,
    })

    // Creates a DynamoDB Table for storing the cached v3 pools
    this.cachedV3PoolsDynamoDb = new aws_dynamodb.Table(this, 'V3PoolsCachingDB', V3PoolsDynamoDbProps)
  }
}
