import { SimulationStatus } from "@uniswap/smart-order-router"
import Logger from "bunyan"

export const simulationStatusToString = (simulationStatus: SimulationStatus, log: Logger) => {
  switch (simulationStatus) {
    case SimulationStatus.Succeeded:
      return 'SUCCESS'
    case SimulationStatus.Failed:
      return 'FAILED'
    case SimulationStatus.NotApproved:
      return 'NOTAPPROVED'
    case SimulationStatus.InsufficientBalance:
      return 'INSUFFICIENTBALANCE'
    case SimulationStatus.NotSupported:
      return 'NOTSUPPORTED'
    default:
      log.error(`Unknown simulation status ${simulationStatus}`)
      return ''
  }
}