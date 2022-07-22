import { log } from '@uniswap/smart-order-router'
import axios from 'axios'

// Swap Router Contract
const V3_ROUTER2_ADDRESS = '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45'

// API for GET+DELETE
export const TENDERLY_FORK_API_URL = (FORK_ID: string): string => `https://rpc.tenderly.co/fork/${FORK_ID}`

// API For POST
export const POST_TENDERLY_FORK_API_URL = (
  TENDERLY_BASE_URL: string,
  TENDERLY_USER: string,
  TENDERLY_PROJECT: string
) => `${TENDERLY_BASE_URL}/api/v1/account/${TENDERLY_USER}/project/${TENDERLY_PROJECT}/fork`

export const TENDERLY_BATCH_SIMULATE = (TENDERLY_BASE_URL: string, TENDERLY_USER: string, TENDERLY_PROJECT: string) =>
  `${TENDERLY_BASE_URL}/api/v1/account/${TENDERLY_USER}/project/${TENDERLY_PROJECT}/simulate-batch`

export const APPROVE_TOKEN_FOR_TRANSFER =
  '0x095ea7b300000000000000000000000068b3465833fb72a70ecdf485e0e4c7bd8665fc45ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'

export interface ISimulator {
  simulateTransaction: (
    chainId: number,
    hexData: string,
    tokenInAddress: string,
    fromAddress: string,
    blockNumber: number,
    // For the HeuristicFallback Implementation
    fallback?: number
  ) => Promise<number | Error> | number
}
export class TenderlyProvider implements ISimulator {
  TENDERLY_BASE_URL: string
  TENDERLY_USER: string
  TENDERLY_PROJECT: string
  TENDERLY_ACCESS_KEY: string
  constructor(TENDERLY_BASE_URL: string, TENDERLY_USER: string, TENDERLY_PROJECT: string, TENDERLY_ACCESS_KEY: string) {
    this.TENDERLY_BASE_URL = TENDERLY_BASE_URL
    this.TENDERLY_USER = TENDERLY_USER
    this.TENDERLY_PROJECT = TENDERLY_PROJECT
    this.TENDERLY_ACCESS_KEY = TENDERLY_ACCESS_KEY
  }

  public async simulateTransaction(
    chainId: number,
    hexData: string,
    tokenInAddress: string,
    fromAddress: string,
    blockNumber: number,
    fallback?: number
  ): Promise<number | Error> {
    log.info(
      {
        hexData: hexData,
        fromAddress: fromAddress,
        chainId: chainId,
        tokenInAddress: tokenInAddress,
        blockNumber: blockNumber,
      },
      'Simulating transaction via Tenderly'
    )

    const approve = {
      network_id: chainId,
      input: APPROVE_TOKEN_FOR_TRANSFER,
      to: tokenInAddress,
      value: '0',
      from: fromAddress,
      gasPrice: '0',
      gas: 30000000,
    }

    const swap = {
      network_id: chainId,
      input: hexData,
      to: V3_ROUTER2_ADDRESS,
      value: '0',
      from: fromAddress,
      gasPrice: '0',
      gas: 30000000,
      type: 1,
    }

    const body = { simulations: [approve, swap] }
    body
    const opts = {
      headers: {
        'X-Access-Key': this.TENDERLY_ACCESS_KEY,
      },
    }
    const url = TENDERLY_BATCH_SIMULATE(this.TENDERLY_BASE_URL, this.TENDERLY_USER, this.TENDERLY_PROJECT)
    let resp: any
    try {
      resp = await axios.post(url, body, opts)
    } catch (error) {
      log.info(`Failed to Simulate Via Tenderly!`)
      if (!fallback) {
        return new Error('`Failed to Simulate Via Tenderly! No fallback set!`')
      }
      log.info(`Defaulting to fallback return value of: ${fallback}s.`)
      return fallback
    }
    log.info({ resp: resp.data.simulation_results }, 'Simulated Transaction Via Tenderly')
    return resp.data.simulation_results[1].transaction.gas_used as number
  }
}
