import { DynamoDBTableProps } from '../../../../bin/stacks/routing-database-stack'
import { default as bunyan } from 'bunyan'
import { expect } from 'chai'
import { AlarmEvent, FallbackHandler } from '../../../../lib/rpc/handler/FallbackHandler'
import Sinon from 'sinon'
import { ProviderHealthStateDynamoDbRepository } from '../../../../lib/rpc/ProviderHealthStateDynamoDbRepository'
import { ProviderHealthiness } from '../../../../lib/rpc/ProviderHealthState'

const PROVIDER_ID = '56_QUIKNODE'

const log = bunyan.createLogger({
  name: 'ProviderHealthStateDynamoDbRepositoryTest',
  serializers: bunyan.stdSerializers,
  level: bunyan.DEBUG,
})

describe('FallbackHandler', () => {
  process.env = {
    PROVIDER_HEALTH_STATE_DB_TABLE_NAME: DynamoDBTableProps.RpcProviderHealthStateDbTable.Name,
  }
  const fallbackHandler = new FallbackHandler(log)
  const realisticAlarm = JSON.parse(`
    {
      "source": "aws.cloudwatch",
      "alarmArn": "arn:aws:cloudwatch:us-east-2:901338192186:alarm:RoutingAPI-RpcGateway-ErrorRateAlarm-ChainId-56-Provider-QUIKNODE",
      "accountId": "901338192186",
      "time": "2024-04-16T08:47:36.960+0000",
      "region": "us-east-2",
      "alarmData": {
        "alarmName": "RoutingAPI-RpcGateway-ErrorRateAlarm-ChainId-56-Provider-QUIKNODE",
        "state": {
          "value": "ALARM",
          "reason": "Threshold Crossed: 1 datapoint [161.0 (16/04/24 08:42:00)] was greater than or equal to the threshold (150.0).",
          "reasonData": "{\\"version\\":\\"1.0\\",\\"queryDate\\":\\"2024-04-16T08:47:36.958+0000\\",\\"startDate\\":\\"2024-04-16T08:42:00.000+0000\\",\\"period\\":300,\\"recentDatapoints\\":[161.0],\\"threshold\\":150.0,\\"evaluatedDatapoints\\":[{\\"timestamp\\":\\"2024-04-16T08:42:00.000+0000\\",\\"value\\":161.0}]}",
          "timestamp": "2024-04-16T08:47:36.960+0000"
        },
        "previousState": {
          "value": "OK",
          "reason": "Threshold Crossed: 1 datapoint [95.0 (16/04/24 08:33:00)] was not greater than or equal to the threshold (150.0).",
          "reasonData": "{\\"version\\":\\"1.0\\",\\"queryDate\\":\\"2024-04-16T08:43:36.957+0000\\",\\"startDate\\":\\"2024-04-16T08:33:00.000+0000\\",\\"period\\":300,\\"recentDatapoints\\":[95.0],\\"threshold\\":150.0,\\"evaluatedDatapoints\\":[{\\"timestamp\\":\\"2024-04-16T08:33:00.000+0000\\",\\"value\\":95.0}]}",
          "timestamp": "2024-04-16T08:43:36.960+0000"
        },
        "configuration": {
          "metrics": [
            {
              "id": "expr_1",
              "expression": "callSuccesses",
              "returnData": true
            },
            {
              "id": "callSuccesses",
              "metricStat": {
                "metric": {
                  "namespace": "Uniswap",
                  "name": "RPC_GATEWAY_56_QUIKNODE_SUCCESS",
                  "dimensions": {
                    "Service": "RoutingAPI"
                  }
                },
                "period": 300,
                "stat": "Sum",
                "unit": "Count"
              },
              "returnData": false
            }
          ]
        }
      }
    }`)

  it('test readAlarmEvent', async () => {
    const alarmEvent = fallbackHandler.readAlarmEvent(realisticAlarm)
    console.log(alarmEvent)
    expect(alarmEvent.alarmName).equals('RoutingAPI-RpcGateway-ErrorRateAlarm-ChainId-56-Provider-QUIKNODE')
    expect(alarmEvent.state).equals('ALARM')
    expect(alarmEvent.previousState).equals('OK')
    expect(alarmEvent.reason).equals(
      'Threshold Crossed: 1 datapoint [161.0 (16/04/24 08:42:00)] was greater than or equal to the threshold (150.0).'
    )
    expect(alarmEvent.providerId).equals(PROVIDER_ID)
  })

  describe('verify we do DB update when alarm', async () => {
    let stubRepo: Sinon.SinonStubbedInstance<ProviderHealthStateDynamoDbRepository>
    let alarmEvent: AlarmEvent

    beforeEach(() => {
      stubRepo = Sinon.createStubInstance(ProviderHealthStateDynamoDbRepository)
      stubRepo.read.resolves()
      stubRepo.write.resolves()
      stubRepo.update.resolves()
      fallbackHandler['healthStateRepository'] = stubRepo

      alarmEvent = {
        alarmName: 'alarm1',
        state: 'ALARM',
        previousState: 'OK',
        providerId: PROVIDER_ID,
        reason: 'reason',
      }
    })

    afterEach(() => {
      stubRepo.read.reset()
      stubRepo.write.reset()
      stubRepo.update.reset()
    })

    it('no previous alarm, DB reads null', async () => {
      stubRepo.read.resolves(null)
      const { oldHealthiness, newHealthiness } = await fallbackHandler['updateDbItemForAlarmEvent'](alarmEvent)

      expect(stubRepo.update.callCount).equals(0)
      expect(stubRepo.write.callCount).equals(1)
      expect(stubRepo.write.getCall(0).args[0]).deep.equals(PROVIDER_ID)
      expect(stubRepo.write.getCall(0).args[1]).deep.equals({
        healthiness: ProviderHealthiness.UNHEALTHY,
        ongoingAlarms: ['alarm1'],
        version: 1,
      })
      expect(oldHealthiness).equals(ProviderHealthiness.HEALTHY)
      expect(newHealthiness).equals(ProviderHealthiness.UNHEALTHY)
    })

    it('no previous alarm, DB reads healthy provider state', async () => {
      stubRepo.read.resolves({
        healthiness: ProviderHealthiness.HEALTHY,
        ongoingAlarms: [],
        version: 1,
      })
      const { oldHealthiness, newHealthiness } = await fallbackHandler['updateDbItemForAlarmEvent'](alarmEvent)

      expect(stubRepo.write.callCount).equals(0)
      expect(stubRepo.update.callCount).equals(1)
      expect(stubRepo.update.getCall(0).args[0]).deep.equals(PROVIDER_ID)
      expect(stubRepo.update.getCall(0).args[1]).deep.equals({
        healthiness: ProviderHealthiness.UNHEALTHY,
        ongoingAlarms: ['alarm1'],
        version: 2,
      })
      expect(oldHealthiness).equals(ProviderHealthiness.HEALTHY)
      expect(newHealthiness).equals(ProviderHealthiness.UNHEALTHY)
    })

    it('has previous alarm, new alarm event repeats', async () => {
      stubRepo.read.resolves({
        healthiness: ProviderHealthiness.UNHEALTHY,
        ongoingAlarms: ['alarm1', 'alarm2'],
        version: 1,
      })
      const { oldHealthiness, newHealthiness } = await fallbackHandler['updateDbItemForAlarmEvent'](alarmEvent)

      expect(stubRepo.write.callCount).equals(0)
      expect(stubRepo.update.callCount).equals(1)
      expect(stubRepo.update.getCall(0).args[0]).deep.equals(PROVIDER_ID)
      expect(stubRepo.update.getCall(0).args[1]).deep.equals({
        healthiness: ProviderHealthiness.UNHEALTHY,
        ongoingAlarms: ['alarm1', 'alarm2'],
        version: 2,
      })
      expect(oldHealthiness).equals(ProviderHealthiness.UNHEALTHY)
      expect(newHealthiness).equals(ProviderHealthiness.UNHEALTHY)
    })

    it('has previous alarm, new alarm event does not repeat', async () => {
      stubRepo.read.resolves({
        healthiness: ProviderHealthiness.UNHEALTHY,
        ongoingAlarms: ['alarm2'],
        version: 1,
      })
      const { oldHealthiness, newHealthiness } = await fallbackHandler['updateDbItemForAlarmEvent'](alarmEvent)

      expect(stubRepo.write.callCount).equals(0)
      expect(stubRepo.update.callCount).equals(1)
      expect(stubRepo.update.getCall(0).args[0]).deep.equals(PROVIDER_ID)
      expect(stubRepo.update.getCall(0).args[1]).deep.equals({
        healthiness: ProviderHealthiness.UNHEALTHY,
        ongoingAlarms: ['alarm2', 'alarm1'],
        version: 2,
      })
      expect(oldHealthiness).equals(ProviderHealthiness.UNHEALTHY)
      expect(newHealthiness).equals(ProviderHealthiness.UNHEALTHY)
    })
  })

  describe('verify we do DB update when OK', async () => {
    let stubRepo: Sinon.SinonStubbedInstance<ProviderHealthStateDynamoDbRepository>
    let alarmEvent: AlarmEvent

    beforeEach(() => {
      stubRepo = Sinon.createStubInstance(ProviderHealthStateDynamoDbRepository)
      stubRepo.read.resolves()
      stubRepo.write.resolves()
      stubRepo.update.resolves()
      fallbackHandler['healthStateRepository'] = stubRepo

      alarmEvent = {
        alarmName: 'alarm1',
        state: 'OK',
        previousState: 'ALARM',
        providerId: PROVIDER_ID,
        reason: 'reason',
      }
    })

    afterEach(() => {
      stubRepo.read.reset()
      stubRepo.write.reset()
      stubRepo.update.reset()
    })

    it('no previous alarm, DB reads null', async () => {
      stubRepo.read.resolves(null)
      const { oldHealthiness, newHealthiness } = await fallbackHandler['updateDbItemForOkEvent'](alarmEvent)

      expect(stubRepo.update.callCount).equals(0)
      expect(stubRepo.write.callCount).equals(0)
      expect(oldHealthiness).equals(ProviderHealthiness.HEALTHY)
      expect(newHealthiness).equals(ProviderHealthiness.HEALTHY)
    })

    it('no previous alarm, DB reads healthy provider state', async () => {
      stubRepo.read.resolves({
        healthiness: ProviderHealthiness.HEALTHY,
        ongoingAlarms: [],
        version: 1,
      })
      const { oldHealthiness, newHealthiness } = await fallbackHandler['updateDbItemForOkEvent'](alarmEvent)

      expect(stubRepo.update.callCount).equals(0)
      expect(stubRepo.write.callCount).equals(0)
      expect(oldHealthiness).equals(ProviderHealthiness.HEALTHY)
      expect(newHealthiness).equals(ProviderHealthiness.HEALTHY)
    })

    it('has previous alarm, new alarm event repeats', async () => {
      stubRepo.read.resolves({
        healthiness: ProviderHealthiness.UNHEALTHY,
        ongoingAlarms: ['alarm1', 'alarm2'],
        version: 1,
      })
      const { oldHealthiness, newHealthiness } = await fallbackHandler['updateDbItemForOkEvent'](alarmEvent)

      expect(stubRepo.write.callCount).equals(0)
      expect(stubRepo.update.callCount).equals(1)
      expect(stubRepo.update.getCall(0).args[0]).deep.equals(PROVIDER_ID)
      expect(stubRepo.update.getCall(0).args[1]).deep.equals({
        healthiness: ProviderHealthiness.UNHEALTHY,
        ongoingAlarms: ['alarm2'],
        version: 2,
      })
      expect(oldHealthiness).equals(ProviderHealthiness.UNHEALTHY)
      expect(newHealthiness).equals(ProviderHealthiness.UNHEALTHY)
    })

    it('has previous alarm, new alarm event repeats, all ongoing alarm cleared', async () => {
      stubRepo.read.resolves({
        healthiness: ProviderHealthiness.UNHEALTHY,
        ongoingAlarms: ['alarm1'],
        version: 1,
      })
      const { oldHealthiness, newHealthiness } = await fallbackHandler['updateDbItemForOkEvent'](alarmEvent)

      expect(stubRepo.write.callCount).equals(0)
      expect(stubRepo.update.callCount).equals(1)
      expect(stubRepo.update.getCall(0).args[0]).deep.equals(PROVIDER_ID)
      expect(stubRepo.update.getCall(0).args[1]).deep.equals({
        healthiness: ProviderHealthiness.HEALTHY,
        ongoingAlarms: [],
        version: 2,
      })
      expect(oldHealthiness).equals(ProviderHealthiness.UNHEALTHY)
      expect(newHealthiness).equals(ProviderHealthiness.HEALTHY)
    })

    it('has previous alarm, new alarm event does not repeat', async () => {
      stubRepo.read.resolves({
        healthiness: ProviderHealthiness.UNHEALTHY,
        ongoingAlarms: ['alarm2'],
        version: 1,
      })
      const { oldHealthiness, newHealthiness } = await fallbackHandler['updateDbItemForOkEvent'](alarmEvent)

      expect(stubRepo.write.callCount).equals(0)
      expect(stubRepo.update.callCount).equals(0)
      expect(oldHealthiness).equals(ProviderHealthiness.UNHEALTHY)
      expect(newHealthiness).equals(ProviderHealthiness.UNHEALTHY)
    })
  })
})
