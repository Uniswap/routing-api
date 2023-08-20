import * as cdk from 'aws-cdk-lib'
import * as aws_dynamodb from 'aws-cdk-lib/aws-dynamodb'
import { AttributeType, BillingMode } from 'aws-cdk-lib/aws-dynamodb'
import { Construct } from 'constructs'

export interface RoutingDatabaseStackProps extends cdk.NestedStackProps {}

export const DynamoDBTableProps = {
  CacheRouteDynamoDbTable: {
    Name: 'RouteCachingDB',
    PartitionKeyName: 'pairTradeTypeChainId',
    SortKeyName: 'protocolsBucketBlockNumber',
    SecondaryIndexName: 'protocolsBlockNumberBucket',
    SecondarySortKeyName: 'protocolsBlockNumberBucket',
  },
  CachingRequestFlagDynamoDbTable: {
    Name: 'CacheReqFlagDB',
    PartitionKeyName: 'pairTradeTypeChainId',
    SortKeyName: 'protocolsBucketBlockNumber',
  },
  V3PoolsDynamoDbTable: {
    Name: 'V3PoolsCachingDB',
    PartitionKeyName: 'poolAddress',
    SortKeyName: 'blockNumber',
  },
  TTLAttributeName: 'ttl',
}

export class RoutingDatabaseStack extends cdk.NestedStack {
  public readonly cachedRoutesDynamoDb: aws_dynamodb.Table
  public readonly cachingRequestFlagDynamoDb: aws_dynamodb.Table
  public readonly cachedV3PoolsDynamoDb: aws_dynamodb.Table

  constructor(scope: Construct, name: string, props: RoutingDatabaseStackProps) {
    super(scope, name, props)

    // Creates a DynamoDB Table for storing the cached routes
    this.cachedRoutesDynamoDb = new aws_dynamodb.Table(this, DynamoDBTableProps.CacheRouteDynamoDbTable.Name, {
      tableName: DynamoDBTableProps.CacheRouteDynamoDbTable.Name,
      partitionKey: { name: DynamoDBTableProps.CacheRouteDynamoDbTable.PartitionKeyName, type: AttributeType.STRING },
      sortKey: { name: DynamoDBTableProps.CacheRouteDynamoDbTable.SortKeyName, type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: DynamoDBTableProps.TTLAttributeName,
    })

    this.cachedRoutesDynamoDb.addGlobalSecondaryIndex({
      indexName: DynamoDBTableProps.CacheRouteDynamoDbTable.SecondaryIndexName,
      partitionKey: { name: DynamoDBTableProps.CacheRouteDynamoDbTable.PartitionKeyName, type: AttributeType.STRING },
      sortKey: { name: DynamoDBTableProps.CacheRouteDynamoDbTable.SecondarySortKeyName, type: AttributeType.STRING },
    })

    // Creates a DynamoDB Table for storing the caching request flags
    this.cachingRequestFlagDynamoDb = new aws_dynamodb.Table(
      this,
      DynamoDBTableProps.CachingRequestFlagDynamoDbTable.Name,
      {
        tableName: DynamoDBTableProps.CachingRequestFlagDynamoDbTable.Name,
        partitionKey: {
          name: DynamoDBTableProps.CachingRequestFlagDynamoDbTable.PartitionKeyName,
          type: AttributeType.STRING,
        },
        sortKey: { name: DynamoDBTableProps.CachingRequestFlagDynamoDbTable.SortKeyName, type: AttributeType.STRING },
        billingMode: BillingMode.PAY_PER_REQUEST,
        timeToLiveAttribute: DynamoDBTableProps.TTLAttributeName,
      }
    )

    // Creates a DynamoDB Table for storing the cached v3 pools
    this.cachedV3PoolsDynamoDb = new aws_dynamodb.Table(this, DynamoDBTableProps.V3PoolsDynamoDbTable.Name, {
      tableName: DynamoDBTableProps.V3PoolsDynamoDbTable.Name,
      partitionKey: { name: DynamoDBTableProps.V3PoolsDynamoDbTable.PartitionKeyName, type: AttributeType.STRING },
      sortKey: { name: DynamoDBTableProps.V3PoolsDynamoDbTable.SortKeyName, type: AttributeType.NUMBER },
      billingMode: BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: DynamoDBTableProps.TTLAttributeName,
    })
  }
}
