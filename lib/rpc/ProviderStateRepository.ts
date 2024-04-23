import { ProviderState } from './ProviderState'

export interface ProviderStateWithTimestamp {
  state: ProviderState
  updatedAtInMs: number
}

export abstract class ProviderStateRepository {
  abstract read(providerId: string): Promise<ProviderStateWithTimestamp | null>
  abstract write(
    providerId: string,
    state: ProviderState,
    updatedAtInMs: number,
    prevUpdatedAtInMs?: number
  ): Promise<void>
}
