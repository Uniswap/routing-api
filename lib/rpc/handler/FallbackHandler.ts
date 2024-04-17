import Logger from 'bunyan'
import { ChainId } from '@uniswap/sdk-core'
import { getProviderId } from '../utils'
import { ProviderHealthStateRepository } from '../ProviderHealthStateRepository'
import { ProviderHealthStateDynamoDbRepository } from '../ProviderHealthStateDynamoDbRepository'
import { ProviderHealthState } from '../ProviderHealthState'
import { metric, MetricLoggerUnit } from '@uniswap/smart-order-router'

interface AlarmEvent {
  alarmName: string
  state: string
  previousState: string
  providerId: string
  reason: string
}

export class FallbackHandler {
  private healthStateRepository: ProviderHealthStateRepository
  private log: Logger

  constructor(log: Logger) {
    const dbTableName = process.env.PROVIDER_HEALTH_STATE_DB_TABLE_NAME
    if (!dbTableName) {
      throw new Error('Missing DB_TABLE_NAME in env var')
    }
    this.healthStateRepository = new ProviderHealthStateDynamoDbRepository(dbTableName, log)
    this.log = log
  }

  get handler() {
    return async (event: object) => {
      const alarmEvent = this.readAlarmEvent(event)
      this.log.debug(event, 'Received event object')
      this.log.debug(alarmEvent, 'Parsed alarmEvent')

      if (
        (alarmEvent.previousState === 'OK' || alarmEvent.previousState === 'INSUFFICIENT_DATA') &&
        alarmEvent.state === 'ALARM'
      ) {
        metric.putMetric(`RPC_GATEWAY_FALLBACK_${alarmEvent.providerId}_INTO_UNHEALTHY`, 1, MetricLoggerUnit.Count)
        this.log.error(
          `${alarmEvent.providerId} becomes UNHEALTHY due to ${alarmEvent.previousState}=>ALARM in ${alarmEvent.alarmName}`
        )
        await this.healthStateRepository.write(alarmEvent.providerId, ProviderHealthState.UNHEALTHY)
      } else if (
        alarmEvent.previousState === 'ALARM' &&
        (alarmEvent.state === 'OK' || alarmEvent.state === 'INSUFFICIENT_DATA')
      ) {
        metric.putMetric(`RPC_GATEWAY_FALLBACK_${alarmEvent.providerId}_INTO_RECOVERED`, 1, MetricLoggerUnit.Count)
        this.log.error(
          `${alarmEvent.providerId} becomes RECOVERED due to ALARM=>${alarmEvent.state} in ${alarmEvent.alarmName}`
        )
        await this.healthStateRepository.write(alarmEvent.providerId, ProviderHealthState.RECOVERED)
      }

      return {
        statusCode: 200,
        body: {},
      }
    }
  }

  readAlarmEvent(event: any): AlarmEvent {
    // Example alarm name: "RoutingAPI-RpcGateway-ErrorRateAlarm-ChainId-56-Provider-QUIKNODE"
    const alarmName: string = event.alarmData.alarmName
    const alarmNameTokens = alarmName.split('-')
    const chainId: ChainId = parseInt(alarmNameTokens[4]) as ChainId
    const providerName: string = alarmNameTokens[6]
    if (!chainId || !providerName) {
      throw new Error(`Cannot read chainId and providerName from ${alarmName}`)
    }

    return {
      alarmName: event.alarmData.alarmName,
      state: event.alarmData.state.value,
      previousState: event.alarmData.previousState.value,
      reason: event.alarmData.state.reason,
      providerId: getProviderId(chainId, providerName),
    }
  }
}
