export enum ProviderHealthiness {
  HEALTHY = 'HEALTHY',
  UNHEALTHY = 'UNHEALTHY',
}

export interface ProviderHealthState {
  healthiness: ProviderHealthiness
  ongoingAlarms: string[]
  version: number
}
