import { DynamoDB } from 'aws-sdk'

export interface IDynamoCache<TPKey, TSortKey, TVal> {
  get(partitionKey: TPKey, sortKey?: TSortKey): Promise<TVal | undefined>
  set(value: TVal, partitionKey: TPKey, sortKey?: TSortKey): Promise<boolean>
}

export interface DynamoCachingProps {
  tableName: string
  ttlMinutes?: number
}

export abstract class DynamoCaching<TPKey, TSortKey, TVal> implements IDynamoCache<TPKey, TSortKey, TVal> {
  protected readonly ddbClient: DynamoDB.DocumentClient
  protected readonly tableName: string
  protected readonly ttlMinutes: number

  protected constructor({ tableName, ttlMinutes = 2 }: DynamoCachingProps) {
    this.ddbClient = new DynamoDB.DocumentClient({
      maxRetries: 1,
      retryDelayOptions: {
        base: 20,
      },
      httpOptions: {
        timeout: 100,
      },
    })
    this.tableName = tableName
    this.ttlMinutes = ttlMinutes
  }

  abstract get(partitionKey: TPKey, sortKey?: TSortKey): Promise<TVal | undefined>

  abstract set(value: TVal, partitionKey: TPKey, sortKey?: TSortKey): Promise<boolean>
}
