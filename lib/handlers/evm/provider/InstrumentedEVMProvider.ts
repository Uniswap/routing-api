import { ethers } from 'ethers'
import { Deferrable } from '@ethersproject/properties'
import { TransactionRequest } from '@ethersproject/providers'
import {
  Block,
  BlockTag,
  BlockWithTransactions,
  Filter,
  Log,
  TransactionReceipt,
  TransactionResponse,
} from '@ethersproject/abstract-provider'
import { metric, MetricLoggerUnit } from '@uniswap/smart-order-router'
import { BigNumber, BigNumberish } from '@ethersproject/bignumber'
import { Network, Networkish } from '@ethersproject/networks'
import { ConnectionInfo } from '@ethersproject/web'
import { ProviderName } from './ProviderName'

export type InstrumentedEVMProviderProps = {
  url?: ConnectionInfo | string
  network?: Networkish
  name: ProviderName
}

export class InstrumentedEVMProvider extends ethers.providers.StaticJsonRpcProvider {
  private readonly name: ProviderName
  private readonly metricPrefix: string
  private _blockCache = new Map<string, Promise<any>>()

  private get blockCache() {
    // If the blockCache has not yet been initialized this block, do so by
    // setting a listener to clear it on the next block.
    if (!this._blockCache.size) {
      this.once('block', () => this._blockCache.clear())
    }
    return this._blockCache
  }

  constructor({ url, network, name }: InstrumentedEVMProviderProps) {
    super(url, network)
    this.name = name
    this.metricPrefix = `RPC_${this.name}_${this.network.chainId}`
  }

  // Adds caching functionality to the RPC provider
  override send(method: string, params: Array<any>): Promise<any> {
    // Only cache eth_call's.
    if (method !== 'eth_call') return super.send(method, params)

    try {
      const key = `call:${JSON.stringify(params)}`
      const cached = this.blockCache.get(key)
      if (cached) {
        return cached
      }

      const result = super.send(method, params)
      this.blockCache.set(key, result)
      return result
    } catch (e) {
      return super.send(method, params)
    }
  }

  override call(transaction: Deferrable<TransactionRequest>, blockTag?: BlockTag | Promise<BlockTag>): Promise<string> {
    return super
      .call(transaction, blockTag)
      .then(
        (response) => {
          metric.putMetric(`${this.metricPrefix}_CALL_SUCCESS`, 1, MetricLoggerUnit.Count)
          return response
        },
        (error) => {
          metric.putMetric(`${this.metricPrefix}_CALL_FAILURE`, 1, MetricLoggerUnit.Count)
          throw error
        }
      )
      .finally(() => metric.putMetric(`${this.metricPrefix}_CALL_REQUESTED`, 1, MetricLoggerUnit.Count))
  }

  override estimateGas(transaction: Deferrable<TransactionRequest>): Promise<BigNumber> {
    return super
      .estimateGas(transaction)
      .then(
        (response) => {
          metric.putMetric(`${this.metricPrefix}_ESTIMATEGAS_SUCCESS`, 1, MetricLoggerUnit.Count)
          return response
        },
        (error) => {
          metric.putMetric(`${this.metricPrefix}_ESTIMATEGAS_FAILURE`, 1, MetricLoggerUnit.Count)
          throw error
        }
      )
      .finally(() => metric.putMetric(`${this.metricPrefix}_ESTIMATEGAS_REQUESTED`, 1, MetricLoggerUnit.Count))
  }

  override getBalance(
    addressOrName: string | Promise<string>,
    blockTag?: BlockTag | Promise<BlockTag>
  ): Promise<BigNumber> {
    return super
      .getBalance(addressOrName, blockTag)
      .then(
        (response) => {
          metric.putMetric(`${this.metricPrefix}_GETBALANCE_SUCCESS`, 1, MetricLoggerUnit.Count)
          return response
        },
        (error) => {
          metric.putMetric(`${this.metricPrefix}_GETBALANCE_FAILURE`, 1, MetricLoggerUnit.Count)
          throw error
        }
      )
      .finally(() => metric.putMetric(`${this.metricPrefix}_GETBALANCE_REQUESTED`, 1, MetricLoggerUnit.Count))
  }

  override getBlock(blockHashOrBlockTag: BlockTag | string | Promise<BlockTag | string>): Promise<Block> {
    return super
      .getBlock(blockHashOrBlockTag)
      .then(
        (response) => {
          metric.putMetric(`${this.metricPrefix}_GETBLOCK_SUCCESS`, 1, MetricLoggerUnit.Count)
          return response
        },
        (error) => {
          metric.putMetric(`${this.metricPrefix}_GETBLOCK_FAILURE`, 1, MetricLoggerUnit.Count)
          throw error
        }
      )
      .finally(() => metric.putMetric(`${this.metricPrefix}_GETBLOCK_REQUESTED`, 1, MetricLoggerUnit.Count))
  }

  override getBlockNumber(): Promise<number> {
    return super
      .getBlockNumber()
      .then(
        (response) => {
          metric.putMetric(`${this.metricPrefix}_GETBLOCKNUMBER_SUCCESS`, 1, MetricLoggerUnit.Count)
          return response
        },
        (error) => {
          metric.putMetric(`${this.metricPrefix}_GETBLOCKNUMBER_FAILURE`, 1, MetricLoggerUnit.Count)
          throw error
        }
      )
      .finally(() => metric.putMetric(`${this.metricPrefix}_GETBLOCKNUMBER_REQUESTED`, 1, MetricLoggerUnit.Count))
  }

  override getBlockWithTransactions(
    blockHashOrBlockTag: BlockTag | string | Promise<BlockTag | string>
  ): Promise<BlockWithTransactions> {
    return super
      .getBlockWithTransactions(blockHashOrBlockTag)
      .then(
        (response) => {
          metric.putMetric(`${this.metricPrefix}_GETBLOCKWITHTRANSACTION_SUCCESS`, 1, MetricLoggerUnit.Count)
          return response
        },
        (error) => {
          metric.putMetric(`${this.metricPrefix}_GETBLOCKWITHTRANSACTION_FAILURE`, 1, MetricLoggerUnit.Count)
          throw error
        }
      )
      .finally(() =>
        metric.putMetric(`${this.metricPrefix}_GETBLOCKWITHTRANSACTION_REQUESTED`, 1, MetricLoggerUnit.Count)
      )
  }

  override getCode(addressOrName: string | Promise<string>, blockTag?: BlockTag | Promise<BlockTag>): Promise<string> {
    return super
      .getCode(addressOrName, blockTag)
      .then(
        (response) => {
          metric.putMetric(`${this.metricPrefix}_GETCODE_SUCCESS`, 1, MetricLoggerUnit.Count)
          return response
        },
        (error) => {
          metric.putMetric(`${this.metricPrefix}_GETCODE_FAILURE`, 1, MetricLoggerUnit.Count)
          throw error
        }
      )
      .finally(() => metric.putMetric(`${this.metricPrefix}_GETCODE_REQUESTED`, 1, MetricLoggerUnit.Count))
  }

  override getGasPrice(): Promise<BigNumber> {
    return super
      .getGasPrice()
      .then(
        (response) => {
          metric.putMetric(`${this.metricPrefix}_GETGASPRICE_SUCCESS`, 1, MetricLoggerUnit.Count)
          return response
        },
        (error) => {
          metric.putMetric(`${this.metricPrefix}_GETGASPRICE_FAILURE`, 1, MetricLoggerUnit.Count)
          throw error
        }
      )
      .finally(() => metric.putMetric(`${this.metricPrefix}_GETGASPRICE_REQUESTED`, 1, MetricLoggerUnit.Count))
  }

  override getLogs(filter: Filter): Promise<Array<Log>> {
    return super
      .getLogs(filter)
      .then(
        (response) => {
          metric.putMetric(`${this.metricPrefix}_GETLOGS_SUCCESS`, 1, MetricLoggerUnit.Count)
          return response
        },
        (error) => {
          metric.putMetric(`${this.metricPrefix}_GETLOGS_FAILURE`, 1, MetricLoggerUnit.Count)
          throw error
        }
      )
      .finally(() => metric.putMetric(`${this.metricPrefix}_GETLOGS_REQUESTED`, 1, MetricLoggerUnit.Count))
  }

  override getNetwork(): Promise<Network> {
    return super
      .getNetwork()
      .then(
        (response) => {
          metric.putMetric(`${this.metricPrefix}_GETNETWORK_SUCCESS`, 1, MetricLoggerUnit.Count)
          return response
        },
        (error) => {
          metric.putMetric(`${this.metricPrefix}_GETNETWORK_FAILURE`, 1, MetricLoggerUnit.Count)
          throw error
        }
      )
      .finally(() => metric.putMetric(`${this.metricPrefix}_GETNETWORK_REQUESTED`, 1, MetricLoggerUnit.Count))
  }

  override getStorageAt(
    addressOrName: string | Promise<string>,
    position: BigNumberish | Promise<BigNumberish>,
    blockTag?: BlockTag | Promise<BlockTag>
  ): Promise<string> {
    return super
      .getStorageAt(addressOrName, position, blockTag)
      .then(
        (response) => {
          metric.putMetric(`${this.metricPrefix}_GETSTORAGEAT_SUCCESS`, 1, MetricLoggerUnit.Count)
          return response
        },
        (error) => {
          metric.putMetric(`${this.metricPrefix}_GETSTORAGEAT_FAILURE`, 1, MetricLoggerUnit.Count)
          throw error
        }
      )
      .finally(() => metric.putMetric(`${this.metricPrefix}_GETSTORAGEAT_REQUESTED`, 1, MetricLoggerUnit.Count))
  }

  override getTransaction(transactionHash: string): Promise<TransactionResponse> {
    return super
      .getTransaction(transactionHash)
      .then(
        (response) => {
          metric.putMetric(`${this.metricPrefix}_GETTRANSACTION_SUCCESS`, 1, MetricLoggerUnit.Count)
          return response
        },
        (error) => {
          metric.putMetric(`${this.metricPrefix}_GETTRANSACTION_FAILURE`, 1, MetricLoggerUnit.Count)
          throw error
        }
      )
      .finally(() => metric.putMetric(`${this.metricPrefix}_GETTRANSACTION_REQUESTED`, 1, MetricLoggerUnit.Count))
  }

  override getTransactionCount(
    addressOrName: string | Promise<string>,
    blockTag?: BlockTag | Promise<BlockTag>
  ): Promise<number> {
    return super
      .getTransactionCount(addressOrName, blockTag)
      .then(
        (response) => {
          metric.putMetric(`${this.metricPrefix}_GETTRANSACTIONCOUNT_SUCCESS`, 1, MetricLoggerUnit.Count)
          return response
        },
        (error) => {
          metric.putMetric(`${this.metricPrefix}_GETTRANSACTIONCOUNT_FAILURE`, 1, MetricLoggerUnit.Count)
          throw error
        }
      )
      .finally(() => metric.putMetric(`${this.metricPrefix}_GETTRANSACTIONCOUNT_REQUESTED`, 1, MetricLoggerUnit.Count))
  }

  override getTransactionReceipt(transactionHash: string): Promise<TransactionReceipt> {
    return super
      .getTransactionReceipt(transactionHash)
      .then(
        (response) => {
          metric.putMetric(`${this.metricPrefix}_GETTRANSACTIONRECEIPT_SUCCESS`, 1, MetricLoggerUnit.Count)
          return response
        },
        (error) => {
          metric.putMetric(`${this.metricPrefix}_GETTRANSACTIONRECEIPT_FAILURE`, 1, MetricLoggerUnit.Count)
          throw error
        }
      )
      .finally(() =>
        metric.putMetric(`${this.metricPrefix}_GETTRANSACTIONRECEIPT_REQUESTED`, 1, MetricLoggerUnit.Count)
      )
  }

  override lookupAddress(address: string | Promise<string>): Promise<string | null> {
    return super
      .lookupAddress(address)
      .then(
        (response) => {
          metric.putMetric(`${this.metricPrefix}_LOOKUPADDRESS_SUCCESS`, 1, MetricLoggerUnit.Count)
          return response
        },
        (error) => {
          metric.putMetric(`${this.metricPrefix}_LOOKUPADDRESS_FAILURE`, 1, MetricLoggerUnit.Count)
          throw error
        }
      )
      .finally(() => metric.putMetric(`${this.metricPrefix}_LOOKUPADDRESS_REQUESTED`, 1, MetricLoggerUnit.Count))
  }

  override resolveName(name: string | Promise<string>): Promise<string | null> {
    return super
      .resolveName(name)
      .then(
        (response) => {
          metric.putMetric(`${this.metricPrefix}_RESOLVENAME_SUCCESS`, 1, MetricLoggerUnit.Count)
          return response
        },
        (error) => {
          metric.putMetric(`${this.metricPrefix}_RESOLVENAME_FAILURE`, 1, MetricLoggerUnit.Count)
          throw error
        }
      )
      .finally(() => metric.putMetric(`${this.metricPrefix}_RESOLVENAME_REQUESTED`, 1, MetricLoggerUnit.Count))
  }

  override sendTransaction(signedTransaction: string | Promise<string>): Promise<TransactionResponse> {
    return super
      .sendTransaction(signedTransaction)
      .then(
        (response) => {
          metric.putMetric(`${this.metricPrefix}_SENDTRANSACTION_SUCCESS`, 1, MetricLoggerUnit.Count)
          return response
        },
        (error) => {
          metric.putMetric(`${this.metricPrefix}_SENDTRANSACTION_FAILURE`, 1, MetricLoggerUnit.Count)
          throw error
        }
      )
      .finally(() => metric.putMetric(`${this.metricPrefix}_SENDTRANSACTION_REQUESTED`, 1, MetricLoggerUnit.Count))
  }

  override waitForTransaction(
    transactionHash: string,
    confirmations?: number,
    timeout?: number
  ): Promise<TransactionReceipt> {
    return super
      .waitForTransaction(transactionHash, confirmations, timeout)
      .then(
        (response) => {
          metric.putMetric(`${this.metricPrefix}_WAITFORTRANSACTION_SUCCESS`, 1, MetricLoggerUnit.Count)
          return response
        },
        (error) => {
          metric.putMetric(`${this.metricPrefix}_WAITFORTRANSACTION_FAILURE`, 1, MetricLoggerUnit.Count)
          throw error
        }
      )
      .finally(() => metric.putMetric(`${this.metricPrefix}_WAITFORTRANSACTION_REQUESTED`, 1, MetricLoggerUnit.Count))
  }
}
