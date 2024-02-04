export interface ProviderState {
  [key: string]: number | string,
}

export interface ProviderStateWithTimestamp {
  state: ProviderState,
  updatedAtInMs: number
}

export abstract class ProviderStateStorage {
  abstract read(providerId: string): Promise<ProviderStateWithTimestamp | null>
  abstract write(providerId: string, state: ProviderState, updatedAtInMs: number, prevUpdatedAtInMs?: number): Promise<any>
}