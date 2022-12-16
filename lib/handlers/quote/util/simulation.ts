import { SimulationStatus } from '@uniswap/smart-order-router'
import Logger from 'bunyan'

export const simulationStatusToString = (simulationStatus: SimulationStatus | undefined, log: Logger) => {
  switch (simulationStatus) {
    case undefined:
      return 'UNATTEMPTED'
    case SimulationStatus.Succeeded:
      return 'SUCCESS'
    case SimulationStatus.Failed:
      return 'FAILED'
    case SimulationStatus.InsufficientBalance:
      return 'INSUFFICIENT_BALANCE'
    case SimulationStatus.NotSupported:
      return 'NOT_SUPPORTED'
    case SimulationStatus.NotApproved:
      return 'NOT_APPROVED'
    default:
      log.error(`Unknown simulation status ${simulationStatus}`)
      return ''
  }
}
