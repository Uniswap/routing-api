import { ProviderHealthState } from './ProviderHealthState'

export abstract class ProviderHealthStateRepository {
  abstract read(providerId: string): Promise<ProviderHealthState | null>
  abstract write(providerId: string, providerHealthState: ProviderHealthState): Promise<void>
  abstract update(providerId: string, providerHealthState: ProviderHealthState): Promise<void>
}
