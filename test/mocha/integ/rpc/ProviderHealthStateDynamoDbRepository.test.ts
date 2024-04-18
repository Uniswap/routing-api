import { setupTables } from '../../dbSetup'
import { DynamoDBTableProps } from '../../../../bin/stacks/routing-database-stack'
import { default as bunyan } from 'bunyan'
import { expect } from 'chai'
import { ProviderHealthStateRepository } from '../../../../lib/rpc/ProviderHealthStateRepository'
import { ProviderHealthStateDynamoDbRepository } from '../../../../lib/rpc/ProviderHealthStateDynamoDbRepository'
import { ProviderHealthState } from '../../../../lib/rpc/ProviderHealthState'

const DB_TABLE = {
  TableName: DynamoDBTableProps.RpcProviderHealthStateDbTable.Name,
  KeySchema: [
    {
      AttributeName: 'chainIdProviderName',
      KeyType: 'HASH',
    },
  ],
  AttributeDefinitions: [
    {
      AttributeName: 'chainIdProviderName',
      AttributeType: 'S',
    },
  ],
  ProvisionedThroughput: {
    ReadCapacityUnits: 1,
    WriteCapacityUnits: 1,
  },
}

const PROVIDER_ID = 'provider_id'

const log = bunyan.createLogger({
  name: 'ProviderHealthStateDynamoDbRepositoryTest',
  serializers: bunyan.stdSerializers,
  level: bunyan.DEBUG,
})

describe('ProviderHealthStateDynamoDbRepository', () => {
  setupTables(DB_TABLE)
  const storage: ProviderHealthStateRepository = new ProviderHealthStateDynamoDbRepository(
    DynamoDBTableProps.RpcProviderHealthStateDbTable.Name,
    log
  )

  it('write state to DB then read from it', async () => {
    let readState: ProviderHealthState | null = await storage.read(PROVIDER_ID)
    expect(readState).to.be.null

    await storage.write(PROVIDER_ID, ProviderHealthState.HEALTHY)
    readState = await storage.read(PROVIDER_ID)
    expect(readState).equals(ProviderHealthState.HEALTHY)

    await storage.write(PROVIDER_ID, ProviderHealthState.UNHEALTHY)
    readState = await storage.read(PROVIDER_ID)
    expect(readState).equals(ProviderHealthState.UNHEALTHY)

    await storage.write(PROVIDER_ID, ProviderHealthState.RECOVERED)
    readState = await storage.read(PROVIDER_ID)
    expect(readState).equals(ProviderHealthState.RECOVERED)
  })
})
