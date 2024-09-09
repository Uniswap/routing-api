import { Protocol } from '@uniswap/router-sdk'
import { UniversalRouterVersion } from '@uniswap/universal-router-sdk'

export const SUPPORTED_PROTOCOL_VERSIONS = [Protocol.V2, Protocol.V3, Protocol.V4]

export function convertStringRouterVersionToEnum(routerVersion?: string): UniversalRouterVersion {
  const validVersions = Object.values(UniversalRouterVersion)
  return validVersions.find((v) => v === routerVersion) || UniversalRouterVersion.V1_2
}

export type URVersionsToProtocolVersionsMapping = {
  readonly [universalRouterVersion in UniversalRouterVersion]: Array<Protocol>
}

export const URVersionsToProtocolVersions: URVersionsToProtocolVersionsMapping = {
  [UniversalRouterVersion.V1_2]: [Protocol.V2, Protocol.V3],
  [UniversalRouterVersion.V2_0]: [Protocol.V2, Protocol.V3, Protocol.V4],
}

export function protocolVersionsToBeExcludedFromMixed(universalRouterVersion: UniversalRouterVersion): Protocol[] {
  return SUPPORTED_PROTOCOL_VERSIONS.filter(
    (protocol) => !URVersionsToProtocolVersions[universalRouterVersion].includes(protocol)
  )
}
