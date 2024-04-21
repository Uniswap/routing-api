import { setupTables } from '../../dbSetup'
import { DynamoDBTableProps } from '../../../../bin/stacks/routing-database-stack'
import { default as bunyan } from 'bunyan'
import chai, { expect } from 'chai'
import { ProviderHealthStateRepository } from '../../../../lib/rpc/ProviderHealthStateRepository'
import { ProviderHealthStateDynamoDbRepository } from '../../../../lib/rpc/ProviderHealthStateDynamoDbRepository'
import { ProviderHealthiness, ProviderHealthState } from '../../../../lib/rpc/ProviderHealthState'
import chaiAsPromised from 'chai-as-promised'

chai.use(chaiAsPromised)

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

  it('write state to DB then read from it, empty case', async () => {
    let readState: ProviderHealthState | null = await storage.read(PROVIDER_ID)
    expect(readState).to.be.null
  })

  it('write state to DB then read from it, new item', async () => {
    await storage.write(PROVIDER_ID, {
      healthiness: ProviderHealthiness.HEALTHY,
      ongoingAlarms: [],
      version: 1,
    })
    const readState = await storage.read(PROVIDER_ID)
    expect(readState).deep.equals({
      healthiness: ProviderHealthiness.HEALTHY,
      ongoingAlarms: [],
      version: 1,
    })
  })

  it('write state can overwrite existing DB item', async () => {
    await storage.write(PROVIDER_ID, {
      healthiness: ProviderHealthiness.HEALTHY,
      ongoingAlarms: [],
      version: 1,
    })
    await storage.write(PROVIDER_ID, {
      healthiness: ProviderHealthiness.UNHEALTHY,
      ongoingAlarms: ['alarm1'],
      version: 1,
    })
    const readState = await storage.read(PROVIDER_ID)
    expect(readState).deep.equals({
      healthiness: ProviderHealthiness.UNHEALTHY,
      ongoingAlarms: ['alarm1'],
      version: 1,
    })
  })

  it('Update item, with expected base version', async () => {
    await storage.write(PROVIDER_ID, {
      healthiness: ProviderHealthiness.HEALTHY,
      ongoingAlarms: [],
      version: 1,
    })
    await storage.update(PROVIDER_ID, {
      healthiness: ProviderHealthiness.UNHEALTHY,
      ongoingAlarms: ['alarm1', 'alarm2'],
      version: 2,
    })
    const readState = await storage.read(PROVIDER_ID)
    expect(readState).deep.equals({
      healthiness: ProviderHealthiness.UNHEALTHY,
      ongoingAlarms: ['alarm1', 'alarm2'],
      version: 2,
    })
  })

  it('Update item, with unexpected base version', async () => {
    await storage.write(PROVIDER_ID, {
      healthiness: ProviderHealthiness.HEALTHY,
      ongoingAlarms: [],
      version: 2,
    })
    // This update should fail, because it expects the version of existing item is 1.
    await expect(
      storage.update(PROVIDER_ID, {
        healthiness: ProviderHealthiness.UNHEALTHY,
        ongoingAlarms: ['alarm1'],
        version: 2,
      })
    ).to.be.rejectedWith(Error)
    // DB entry isn't updated
    const readState = await storage.read(PROVIDER_ID)
    expect(readState).deep.equals({
      healthiness: ProviderHealthiness.HEALTHY,
      ongoingAlarms: [],
      version: 2,
    })
  })
})
