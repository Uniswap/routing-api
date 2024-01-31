import { setupTables } from '../../dbSetup'
import { DynamoDBTableProps } from '../../../../bin/stacks/routing-database-stack'
import { default as bunyan } from 'bunyan'
import chai, { expect } from 'chai'
import Sinon from 'sinon'
import chaiAsPromised from 'chai-as-promised'
import { ProviderStateRepository, ProviderStateWithTimestamp } from '../../../../lib/rpc/ProviderStateRepository'
import { ProviderStateDynamoDbRepository } from '../../../../lib/rpc/ProviderStateDynamoDbRepository'
import { ProviderState } from '../../../../lib/rpc/ProviderState'

chai.use(chaiAsPromised)

const DB_TABLE = {
  TableName: DynamoDBTableProps.RpcProviderStateDbTable.Name,
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
  name: 'HealthStateSyncerTest',
  serializers: bunyan.stdSerializers,
  level: bunyan.DEBUG,
})

describe('ProviderStateDynamoDbRepository', () => {
  setupTables(DB_TABLE)
  const storage: ProviderStateRepository = new ProviderStateDynamoDbRepository(
    DynamoDBTableProps.RpcProviderStateDbTable.Name,
    log
  )

  it('write state to DB then read from it', async () => {
    const timestamp = Date.now()
    const state: ProviderState = {
      healthScore: -10,
      latencies: [
        {
          timestampInMs: timestamp,
          latencyInMs: 200,
        },
        {
          timestampInMs: timestamp - 1000,
          latencyInMs: 400,
        },
      ],
    }
    await storage.write(PROVIDER_ID, state, timestamp)

    const readState: ProviderStateWithTimestamp | null = await storage.read(PROVIDER_ID)

    expect(readState !== null)
    expect(readState!.state.healthScore).equal(-10)
    expect(readState!.state.latencies[0].timestampInMs).equal(timestamp)
    expect(readState!.state.latencies[0].latencyInMs).equal(200)
    expect(readState!.state.latencies[1].timestampInMs).equal(timestamp - 1000)
    expect(readState!.state.latencies[1].latencyInMs).equal(400)
  })

  it('write state to DB then read from it later, but it already expired', async () => {
    const timestamp = Date.now()
    const clock = Sinon.useFakeTimers(timestamp)

    const state: ProviderState = {
      healthScore: -10,
      latencies: [
        {
          timestampInMs: timestamp,
          latencyInMs: 200,
        },
      ],
    }
    await storage.write(PROVIDER_ID, state, timestamp)

    clock.tick(60000) // Exceed TTL which is 30 seconds

    const readState: ProviderStateWithTimestamp | null = await storage.read(PROVIDER_ID)
    expect(readState === null)
  })

  it('write state to DB then write it again: Timestamp match', async () => {
    const timestamp = Date.now()
    const state: ProviderState = {
      healthScore: -10,
      latencies: [
        {
          timestampInMs: timestamp,
          latencyInMs: 200,
        },
      ],
    }
    await storage.write(PROVIDER_ID, state, timestamp)

    await storage.write(PROVIDER_ID, state, timestamp + 1000, timestamp)
  })

  it('write state to DB then write it again:: Timestamp mismatch', async () => {
    const timestamp = Date.now()
    const state: ProviderState = {
      healthScore: -10,
      latencies: [
        {
          timestampInMs: timestamp,
          latencyInMs: 200,
        },
      ],
    }
    await storage.write(PROVIDER_ID, state, timestamp)

    await expect(storage.write(PROVIDER_ID, state, timestamp + 1000, timestamp + 100)).to.be.rejectedWith(Error)
  })
})
