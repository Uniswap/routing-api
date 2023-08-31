import * as cdk from 'aws-cdk-lib'
import * as aws_dynamodb from 'aws-cdk-lib/aws-dynamodb'
import { AttributeType, BillingMode } from 'aws-cdk-lib/aws-dynamodb'
import { Construct } from 'constructs'

export interface RoutingDatabaseStackProps extends cdk.NestedStackProps {}

export const DynamoDBTableProps = {
  RoutesDbTable: {
    Name: 'RoutesDB',
    PartitionKeyName: 'pairTradeTypeChainId',
    SortKeyName: 'routeId',
  },
  RoutesDbCachingRequestFlagTable: {
    Name: 'RoutesDbCacheReqFlagDB',
    PartitionKeyName: 'pairTradeTypeChainId',
    SortKeyName: 'amount',
  },
  V3PoolsDynamoDbTable: {
    Name: 'V3PoolsCachingDB',
    PartitionKeyName: 'poolAddress',
    SortKeyName: 'blockNumber',
  },
  V2PairsDynamoCache: {
    Name: 'V2PairsCachingDB',
    PartitionKeyName: 'cacheKey',
    SortKeyName: 'block',
  },
  TTLAttributeName: 'ttl',
}

export class RoutingDatabaseStack extends cdk.NestedStack {
  public readonly routesDynamoDb: aws_dynamodb.Table
  public readonly routesDbCachingRequestFlagDynamoDb: aws_dynamodb.Table
  public readonly cachedV3PoolsDynamoDb: aws_dynamodb.Table
  public readonly cachedV2PairsDynamoDb: aws_dynamodb.Table

  constructor(scope: Construct, name: string, props: RoutingDatabaseStackProps) {
    super(scope, name, props)

    // Creates a DynamoDB Table for storing the routes
    this.routesDynamoDb = new aws_dynamodb.Table(this, DynamoDBTableProps.RoutesDbTable.Name, {
      tableName: DynamoDBTableProps.RoutesDbTable.Name,
      partitionKey: { name: DynamoDBTableProps.RoutesDbTable.PartitionKeyName, type: AttributeType.STRING },
      sortKey: { name: DynamoDBTableProps.RoutesDbTable.SortKeyName, type: AttributeType.NUMBER },
      billingMode: BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: DynamoDBTableProps.TTLAttributeName,
    })

    // Creates a DynamoDB Table for storing the buckets that are flagging as already cached in the RoutesDb
    this.routesDbCachingRequestFlagDynamoDb = new aws_dynamodb.Table(
      this,
      DynamoDBTableProps.RoutesDbCachingRequestFlagTable.Name,
      {
        tableName: DynamoDBTableProps.RoutesDbCachingRequestFlagTable.Name,
        partitionKey: {
          name: DynamoDBTableProps.RoutesDbCachingRequestFlagTable.PartitionKeyName,
          type: AttributeType.STRING,
        },
        sortKey: { name: DynamoDBTableProps.RoutesDbCachingRequestFlagTable.SortKeyName, type: AttributeType.NUMBER },
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

    // Creates a DynamoDB Table for storing the cached v2 pairs
    this.cachedV2PairsDynamoDb = new aws_dynamodb.Table(this, DynamoDBTableProps.V2PairsDynamoCache.Name, {
      tableName: DynamoDBTableProps.V2PairsDynamoCache.Name,
      partitionKey: { name: DynamoDBTableProps.V2PairsDynamoCache.PartitionKeyName, type: AttributeType.STRING },
      sortKey: { name: DynamoDBTableProps.V2PairsDynamoCache.SortKeyName, type: AttributeType.NUMBER },
      billingMode: BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: DynamoDBTableProps.TTLAttributeName,
    })
  }
}
