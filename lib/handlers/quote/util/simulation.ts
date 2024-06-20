import { SimulationStatus } from '@uniswap/smart-order-router'
import Logger from 'bunyan'

export enum RoutingApiSimulationStatus {
  UNATTEMPTED = 'UNATTEMPTED',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  NOT_SUPPORTED = 'NOT_SUPPORTED',
  NOT_APPROVED = 'NOT_APPROVED',
  UNKNOWN = '',
}

export const simulationStatusTranslation = (
  simulationStatus: SimulationStatus | undefined,
  log: Logger
): RoutingApiSimulationStatus => {
  switch (simulationStatus) {
    case undefined:
      return RoutingApiSimulationStatus.UNATTEMPTED
    case SimulationStatus.Succeeded:
      return RoutingApiSimulationStatus.SUCCESS
    case SimulationStatus.Failed:
      return RoutingApiSimulationStatus.FAILED
    case SimulationStatus.InsufficientBalance:
      return RoutingApiSimulationStatus.INSUFFICIENT_BALANCE
    case SimulationStatus.NotSupported:
      return RoutingApiSimulationStatus.NOT_SUPPORTED
    case SimulationStatus.NotApproved:
      return RoutingApiSimulationStatus.NOT_APPROVED
    default:
      log.error(`Unknown simulation status ${simulationStatus}`)
      return RoutingApiSimulationStatus.UNKNOWN
  }
}
