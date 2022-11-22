import { SimulationStatus } from "@uniswap/smart-order-router"
import Logger from "bunyan"

export const simulationStatusToString = (simulationStatus: SimulationStatus, log: Logger) => {
  switch (simulationStatus) {
    case SimulationStatus.Succeeded:
      return 'SUCCESS'
    case SimulationStatus.Failed:
      return 'FAILED'
    case SimulationStatus.Unattempted:
      return 'UNATTEMPTED'
    default:
      log.error(`Unknown simulation status ${simulationStatus}`)
      return ''
  }
}