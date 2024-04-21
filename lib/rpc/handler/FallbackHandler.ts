import Logger from 'bunyan'
import { ChainId } from '@uniswap/sdk-core'
import { getProviderId } from '../utils'
import { ProviderHealthStateRepository } from '../ProviderHealthStateRepository'
import { ProviderHealthStateDynamoDbRepository } from '../ProviderHealthStateDynamoDbRepository'
import { ProviderHealthiness, ProviderHealthState } from '../ProviderHealthState'
import { MetricLoggerUnit } from '@uniswap/smart-order-router'
import { metricScope, MetricsLogger } from 'aws-embedded-metrics'
import { APIGatewayProxyResult } from 'aws-lambda'
import { AWSMetricsLogger } from '../../handlers/router-entities/aws-metrics-logger'

export interface AlarmEvent {
  alarmName: string
  state: string
  previousState: string // Only for logging purpose. Not used in any logic.
  providerId: string
  reason: string // Only for logging purpose. Not used in any logic
}

export class HealthinessUpdate {
  constructor(public oldHealthiness: ProviderHealthiness, public newHealthiness: ProviderHealthiness) {}
  isChanged(): boolean {
    return this.oldHealthiness !== this.newHealthiness
  }
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

  private buildHandler() {
    return metricScope((metricsLogger: MetricsLogger) => async (event: object): Promise<APIGatewayProxyResult> => {
      metricsLogger.setNamespace('Uniswap')
      metricsLogger.setDimensions({ Service: 'RoutingAPI' })
      const metric = new AWSMetricsLogger(metricsLogger)

      const alarmEvent = this.readAlarmEvent(event)
      this.log.debug({ alarmEvent }, 'Parsed alarmEvent')

      const healthinessUpdate = await this.processAlarm(alarmEvent, metric)

      this.log.debug({ alarmEvent, healthinessUpdate }, 'Handler response')
      return {
        statusCode: 200,
        body: JSON.stringify({
          alarmEvent,
          healthinessUpdate,
        }),
      }
    })
  }

  get handler() {
    return async (event: object): Promise<APIGatewayProxyResult> => {
      const handler = this.buildHandler()
      this.log.debug({ event }, 'Received event object')
      const response = await handler(event)
      this.log.debug({ response }, 'Response of fallback handler')
      return response
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

  private async processAlarm(alarmEvent: AlarmEvent, metric: AWSMetricsLogger): Promise<HealthinessUpdate> {
    let healthinessUpdate = new HealthinessUpdate(ProviderHealthiness.HEALTHY, ProviderHealthiness.HEALTHY)

    if (alarmEvent.state === 'ALARM') {
      healthinessUpdate = await this.updateDbItemWhenAlarm(alarmEvent)
      if (healthinessUpdate.isChanged()) {
        metric.putMetric(`RPC_GATEWAY_FALLBACK_${alarmEvent.providerId}_INTO_UNHEALTHY`, 1, MetricLoggerUnit.Count)
        this.log.error(
          `${alarmEvent.providerId} becomes UNHEALTHY due to ${alarmEvent.previousState}=>ALARM in ${alarmEvent.alarmName}`
        )
      }
    } else if (alarmEvent.state === 'OK') {
      healthinessUpdate = await this.updateDbItemWhenOk(alarmEvent)
      if (healthinessUpdate.isChanged()) {
        metric.putMetric(`RPC_GATEWAY_FALLBACK_${alarmEvent.providerId}_INTO_HEALTHY`, 1, MetricLoggerUnit.Count)
        this.log.error(
          `${alarmEvent.providerId} becomes HEALTHY due to ${alarmEvent.previousState}=>OK in ${alarmEvent.alarmName}`
        )
      }
    }
    return healthinessUpdate
  }

  private async updateDbItemWhenAlarm(alarmEvent: AlarmEvent): Promise<HealthinessUpdate> {
    const state: ProviderHealthState | null = await this.healthStateRepository.read(alarmEvent.providerId)
    if (state === null) {
      const newState: ProviderHealthState = {
        healthiness: ProviderHealthiness.UNHEALTHY,
        ongoingAlarms: [alarmEvent.alarmName],
        version: 1,
      }
      await this.healthStateRepository.write(alarmEvent.providerId, newState)
    } else {
      const newOngoingAlarms = state.ongoingAlarms
      if (!state.ongoingAlarms.includes(alarmEvent.alarmName)) {
        newOngoingAlarms.push(alarmEvent.alarmName)
      }
      const newState: ProviderHealthState = {
        healthiness: ProviderHealthiness.UNHEALTHY,
        ongoingAlarms: newOngoingAlarms,
        version: state.version + 1,
      }
      await this.healthStateRepository.update(alarmEvent.providerId, newState)
    }

    // Return true if it becomes unhealthy from healthy.
    return new HealthinessUpdate(
      state === null || state.healthiness === ProviderHealthiness.HEALTHY
        ? ProviderHealthiness.HEALTHY
        : ProviderHealthiness.UNHEALTHY,
      ProviderHealthiness.UNHEALTHY
    )
  }

  private async updateDbItemWhenOk(alarmEvent: AlarmEvent): Promise<HealthinessUpdate> {
    const state: ProviderHealthState | null = await this.healthStateRepository.read(alarmEvent.providerId)
    if (state === null || state.healthiness === ProviderHealthiness.HEALTHY) {
      return new HealthinessUpdate(ProviderHealthiness.HEALTHY, ProviderHealthiness.HEALTHY)
    }
    if (!state.ongoingAlarms.includes(alarmEvent.alarmName)) {
      return new HealthinessUpdate(ProviderHealthiness.UNHEALTHY, ProviderHealthiness.UNHEALTHY)
    }
    const newOngoingAlarms = state.ongoingAlarms.filter((alarmName) => alarmName !== alarmEvent.alarmName)
    const newState: ProviderHealthState = {
      healthiness: newOngoingAlarms.length === 0 ? ProviderHealthiness.HEALTHY : ProviderHealthiness.UNHEALTHY,
      ongoingAlarms: newOngoingAlarms,
      version: state.version + 1,
    }
    await this.healthStateRepository.update(alarmEvent.providerId, newState)
    return new HealthinessUpdate(
      ProviderHealthiness.UNHEALTHY,
      newOngoingAlarms.length === 0 ? ProviderHealthiness.HEALTHY : ProviderHealthiness.UNHEALTHY
    )
  }
}
