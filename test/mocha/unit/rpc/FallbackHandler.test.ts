import { DynamoDBTableProps } from '../../../../bin/stacks/routing-database-stack'
import { default as bunyan } from 'bunyan'
import { expect } from 'chai'
import { FallbackHandler } from '../../../../lib/rpc/handler/FallbackHandler'
import Sinon from 'sinon'
import { ProviderHealthStateDynamoDbRepository } from '../../../../lib/rpc/ProviderHealthStateDynamoDbRepository'

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
  const triggerEvent = JSON.parse(`
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
  const recoverEvent = JSON.parse(`
    {
      "source": "aws.cloudwatch",
      "alarmArn": "arn:aws:cloudwatch:us-east-2:901338192186:alarm:RoutingAPI-RpcGateway-ErrorRateAlarm-ChainId-56-Provider-QUIKNODE",
      "accountId": "901338192186",
      "time": "2024-04-16T08:47:36.960+0000",
      "region": "us-east-2",
      "alarmData": {
        "alarmName": "RoutingAPI-RpcGateway-ErrorRateAlarm-ChainId-56-Provider-QUIKNODE",
        "state": {
          "value": "OK",
          "reason": "Threshold Crossed: 1 datapoint [95.0 (16/04/24 08:33:00)] was not greater than or equal to the threshold (150.0).",
          "reasonData": "{\\"version\\":\\"1.0\\",\\"queryDate\\":\\"2024-04-16T08:43:36.957+0000\\",\\"startDate\\":\\"2024-04-16T08:33:00.000+0000\\",\\"period\\":300,\\"recentDatapoints\\":[95.0],\\"threshold\\":150.0,\\"evaluatedDatapoints\\":[{\\"timestamp\\":\\"2024-04-16T08:33:00.000+0000\\",\\"value\\":95.0}]}",
          "timestamp": "2024-04-16T08:47:36.960+0000"
        },
        "previousState": {
          "value": "ALARM",
          "reason": "Threshold Crossed: 1 datapoint [161.0 (16/04/24 08:42:00)] was greater than or equal to the threshold (150.0).",
          "reasonData": "{\\"version\\":\\"1.0\\",\\"queryDate\\":\\"2024-04-16T08:47:36.958+0000\\",\\"startDate\\":\\"2024-04-16T08:42:00.000+0000\\",\\"period\\":300,\\"recentDatapoints\\":[161.0],\\"threshold\\":150.0,\\"evaluatedDatapoints\\":[{\\"timestamp\\":\\"2024-04-16T08:42:00.000+0000\\",\\"value\\":161.0}]}",
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
    const alarmEvent = fallbackHandler.readAlarmEvent(triggerEvent)
    console.log(alarmEvent)
    expect(alarmEvent.alarmName).equals('RoutingAPI-RpcGateway-ErrorRateAlarm-ChainId-56-Provider-QUIKNODE')
    expect(alarmEvent.state).equals('ALARM')
    expect(alarmEvent.previousState).equals('OK')
    expect(alarmEvent.reason).equals(
      'Threshold Crossed: 1 datapoint [161.0 (16/04/24 08:42:00)] was greater than or equal to the threshold (150.0).'
    )
    expect(alarmEvent.providerId).equals(PROVIDER_ID)
  })

  it('verify we do DB update when alarm is triggered', async () => {
    const stubRepo = Sinon.createStubInstance(ProviderHealthStateDynamoDbRepository)
    stubRepo.write.resolves()
    fallbackHandler['healthStateRepository'] = stubRepo

    const response1 = await fallbackHandler.handler(triggerEvent)
    const response2 = await fallbackHandler.handler(recoverEvent)

    expect(stubRepo.write.callCount).equals(2)
    expect(stubRepo.write.getCall(0).args).deep.equals(['56_QUIKNODE', 'UNHEALTHY'])
    expect(stubRepo.write.getCall(1).args).deep.equals(['56_QUIKNODE', 'HEALTHY'])

    expect(response1).deep.equals({
      statusCode: 200,
      body: '',
    })
    expect(response2).deep.equals({
      statusCode: 200,
      body: '',
    })
  })
})
