import Logger from 'bunyan'
import { ChainId } from '@uniswap/sdk-core'
import { getProviderId } from '../utils'
import { ProviderStateSyncer } from '../ProviderStateSyncer'
import { Provider } from '@ethersproject/providers'

interface AlarmEvent {
  alarmName: string,
  state: string,
  providerId: string,
  reason: string,
}

export class FallbackHandler {
  private dbTableName: string
  private dbSyncers: Map<string, ProviderStateSyncer>
  private log: Logger

  constructor(log: Logger) {
    const dbTableName = process.env.DB_TABLE_NAME
    if (!dbTableName) {
      throw new Error('Missing DB_TABLE_NAME in env var')
    }
    this.dbTableName = dbTableName
    this.dbSyncers = new Map<string, ProviderStateSyncer>()
    this.log = log
    // this.providerStateSyncer = new ProviderStateSyncer(
    //   dbTableName,
    //   this.providerId,
    //   this.config.LATENCY_STAT_HISTORY_WINDOW_LENGTH_IN_S,
    //   log
    // )
  }

  get handler() {
    return async(event: object)=> {
      // TODO implement
      const alarmEvent = this.readAlarmEvent(event)
      this.log.debug(event, 'received event object')
      this.log.debug(alarmEvent, 'Parsed alarmEvent')

      if (!this.dbSyncers.has(alarmEvent.providerId)) {
        this.dbSyncers.set(alarmEvent.providerId, new ProviderStateSyncer(this.dbTableName, alarmEvent.providerId, 0, this.log))
      }
      const syncer = this.dbSyncers.get(alarmEvent.providerId)!

      // TODO: I need new syncer's API
      // syncer.syncWithRepository()


      const response = {
        statusCode: 200,
        body: JSON.stringify('Received alarm!!'),
      }
      return response
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
