import { describe, expect, it } from '@jest/globals'
import { log, SimulationStatus } from '@uniswap/smart-order-router'
import {
  RoutingApiSimulationStatus,
  simulationStatusTranslation,
} from '../../../../../lib/handlers/quote/util/simulation'

describe('simulation', () => {
  it('returns unattempted for undefined simulation status', () => {
    const status = simulationStatusTranslation(undefined, log)
    expect(status).toStrictEqual(RoutingApiSimulationStatus.UNATTEMPTED)
  })

  it('returns success for succeeded simulation status', () => {
    const status = simulationStatusTranslation(SimulationStatus.Succeeded, log)
    expect(status).toStrictEqual(RoutingApiSimulationStatus.SUCCESS)
  })

  it('returns failed for failed simulation status', () => {
    const status = simulationStatusTranslation(SimulationStatus.Failed, log)
    expect(status).toStrictEqual(RoutingApiSimulationStatus.FAILED)
  })

  it('returns insufficient balance for insufficient balance simulation status', () => {
    const status = simulationStatusTranslation(SimulationStatus.InsufficientBalance, log)
    expect(status).toStrictEqual(RoutingApiSimulationStatus.INSUFFICIENT_BALANCE)
  })

  it('returns not supported for not supported simulation status', () => {
    const status = simulationStatusTranslation(SimulationStatus.NotSupported, log)
    expect(status).toStrictEqual(RoutingApiSimulationStatus.NOT_SUPPORTED)
  })

  it('returns not approved for not approved simulation status', () => {
    const status = simulationStatusTranslation(SimulationStatus.NotApproved, log)
    expect(status).toStrictEqual(RoutingApiSimulationStatus.NOT_APPROVED)
  })

  it('returns system down for system down simulation status', () => {
    const status = simulationStatusTranslation(SimulationStatus.SystemDown, log)
    expect(status).toStrictEqual(RoutingApiSimulationStatus.SYSTEM_DOWN)
  })

  it('returns slippage too low for slippage too low simulation status', () => {
    const status = simulationStatusTranslation(SimulationStatus.SlippageTooLow, log)
    expect(status).toStrictEqual(RoutingApiSimulationStatus.SLIPPAGE_TOO_LOW)
  })

  it('returns transfer from failed for transfer from failed simulation status', () => {
    const status = simulationStatusTranslation(SimulationStatus.TransferFromFailed, log)
    expect(status).toStrictEqual(RoutingApiSimulationStatus.TRANSFER_FROM_FAILED)
  })
})
