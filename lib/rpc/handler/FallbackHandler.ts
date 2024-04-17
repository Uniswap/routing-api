import Logger from 'bunyan'
import { ChainId } from '@uniswap/sdk-core'
import { getProviderId } from '../utils'
import { ProviderHealthStateRepository } from '../ProviderHealthStateRepository'
import { ProviderHealthStateDynamoDbRepository } from '../ProviderHealthStateDynamoDbRepository'
import { ProviderHealthState } from '../ProviderHealthState'

interface AlarmEvent {
  alarmName: string,
  state: string,
  providerId: string,
  reason: string,
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
    return async(event: object)=> {
      // TODO implement
      const alarmEvent = this.readAlarmEvent(event)
      this.log.debug(event, 'received event object')
      this.log.debug(alarmEvent, 'Parsed alarmEvent')

      await this.healthStateRepository.write(alarmEvent.providerId, ProviderHealthState.UNHEALTHY)

      return {
        statusCode: 200,
        body: JSON.stringify('Received alarm!!'),
      }
    }
  }

  readAlarmEvent(event: any): AlarmEvent {
    const alarmName: string = event.alarmData.alarmName
    const alarmNameTokens = alarmName.split('-')
    const chainId: ChainId = parseInt(alarmNameTokens[-3]) as ChainId
    const providerName: string = alarmNameTokens[-1]

    return {
      alarmName: event.alarmData.alarmName,
      state: event.alarmData.state.value,
      reason: event.alarmData.state.reason,
      providerId: getProviderId(chainId, providerName),
    }
  }
}
