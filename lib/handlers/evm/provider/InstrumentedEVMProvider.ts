import { ethers } from 'ethers'
import { Deferrable } from '@ethersproject/properties'
import { Listener, TransactionRequest } from '@ethersproject/providers'
import {
  Block,
  BlockTag,
  BlockWithTransactions,
  EventType,
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

export class InstrumentedEVMProvider extends ethers.providers.JsonRpcProvider {
  private readonly name: ProviderName

  constructor({ url, network, name }: InstrumentedEVMProviderProps) {
    super(url, network)
    this.name = name
  }

  override call(transaction: Deferrable<TransactionRequest>, blockTag?: BlockTag | Promise<BlockTag>): Promise<string> {
    metric.putMetric(`RPC_${this.name}_CALL_REQUESTED`, 1, MetricLoggerUnit.Count)
    return super.call(transaction, blockTag).then(
      (response) => {
        metric.putMetric(`RPC_${this.name}_CALL_SUCCESS`, 1, MetricLoggerUnit.Count)
        return response
      },
      (error) => {
        metric.putMetric(`RPC_${this.name}_CALL_FAILURE`, 1, MetricLoggerUnit.Count)
        throw error
      }
    )
  }

  override estimateGas(transaction: Deferrable<TransactionRequest>): Promise<BigNumber> {
    metric.putMetric(`RPC_${this.name}_ESTIMATEGAS_REQUESTED`, 1, MetricLoggerUnit.Count)
    return super.estimateGas(transaction).then(
      (response) => {
        metric.putMetric(`RPC_${this.name}_ESTIMATEGAS_SUCCESS`, 1, MetricLoggerUnit.Count)
        return response
      },
      (error) => {
        metric.putMetric(`RPC_${this.name}_ESTIMATEGAS_FAILURE`, 1, MetricLoggerUnit.Count)
        throw error
      }
    )
  }

  override getBalance(
    addressOrName: string | Promise<string>,
    blockTag?: BlockTag | Promise<BlockTag>
  ): Promise<BigNumber> {
    metric.putMetric(`RPC_${this.name}_GETBALANCE_REQUESTED`, 1, MetricLoggerUnit.Count)
    return super.getBalance(addressOrName, blockTag).then(
      (response) => {
        metric.putMetric(`RPC_${this.name}_GETBALANCE_SUCCESS`, 1, MetricLoggerUnit.Count)
        return response
      },
      (error) => {
        metric.putMetric(`RPC_${this.name}_GETBALANCE_FAILURE`, 1, MetricLoggerUnit.Count)
        throw error
      }
    )
  }

  override getBlock(blockHashOrBlockTag: BlockTag | string | Promise<BlockTag | string>): Promise<Block> {
    metric.putMetric(`RPC_${this.name}_GETBLOCK_REQUESTED`, 1, MetricLoggerUnit.Count)
    return super.getBlock(blockHashOrBlockTag).then(
      (response) => {
        metric.putMetric(`RPC_${this.name}_GETBLOCK_SUCCESS`, 1, MetricLoggerUnit.Count)
        return response
      },
      (error) => {
        metric.putMetric(`RPC_${this.name}_GETBLOCK_FAILURE`, 1, MetricLoggerUnit.Count)
        throw error
      }
    )
  }

  override getBlockNumber(): Promise<number> {
    metric.putMetric(`RPC_${this.name}_GETBLOCKNUMBER_REQUESTED`, 1, MetricLoggerUnit.Count)
    return super.getBlockNumber().then(
      (response) => {
        metric.putMetric(`RPC_${this.name}_GETBLOCKNUMBER_SUCCESS`, 1, MetricLoggerUnit.Count)
        return response
      },
      (error) => {
        metric.putMetric(`RPC_${this.name}_GETBLOCKNUMBER_FAILURE`, 1, MetricLoggerUnit.Count)
        throw error
      }
    )
  }

  override getBlockWithTransactions(
    blockHashOrBlockTag: BlockTag | string | Promise<BlockTag | string>
  ): Promise<BlockWithTransactions> {
    metric.putMetric(`RPC_${this.name}_GETBLOCKWITHTRANSACTION_REQUESTED`, 1, MetricLoggerUnit.Count)
    return super.getBlockWithTransactions(blockHashOrBlockTag).then(
      (response) => {
        metric.putMetric(`RPC_${this.name}_GETBLOCKWITHTRANSACTION_SUCCESS`, 1, MetricLoggerUnit.Count)
        return response
      },
      (error) => {
        metric.putMetric(`RPC_${this.name}_GETBLOCKWITHTRANSACTION_FAILURE`, 1, MetricLoggerUnit.Count)
        throw error
      }
    )
  }

  override getCode(addressOrName: string | Promise<string>, blockTag?: BlockTag | Promise<BlockTag>): Promise<string> {
    metric.putMetric(`RPC_${this.name}_GETCODE_REQUESTED`, 1, MetricLoggerUnit.Count)
    return super.getCode(addressOrName, blockTag).then(
      (response) => {
        metric.putMetric(`RPC_${this.name}_GETCODE_SUCCESS`, 1, MetricLoggerUnit.Count)
        return response
      },
      (error) => {
        metric.putMetric(`RPC_${this.name}_GETCODE_FAILURE`, 1, MetricLoggerUnit.Count)
        throw error
      }
    )
  }

  override getGasPrice(): Promise<BigNumber> {
    metric.putMetric(`RPC_${this.name}_GETGASPRICE_REQUESTED`, 1, MetricLoggerUnit.Count)
    return super.getGasPrice().then(
      (response) => {
        metric.putMetric(`RPC_${this.name}_GETGASPRICE_SUCCESS`, 1, MetricLoggerUnit.Count)
        return response
      },
      (error) => {
        metric.putMetric(`RPC_${this.name}_GETGASPRICE_FAILURE`, 1, MetricLoggerUnit.Count)
        throw error
      }
    )
  }

  override getLogs(filter: Filter): Promise<Array<Log>> {
    metric.putMetric(`RPC_${this.name}_GETLOGS_REQUESTED`, 1, MetricLoggerUnit.Count)
    return super.getLogs(filter).then(
      (response) => {
        metric.putMetric(`RPC_${this.name}_GETLOGS_SUCCESS`, 1, MetricLoggerUnit.Count)
        return response
      },
      (error) => {
        metric.putMetric(`RPC_${this.name}_GETLOGS_FAILURE`, 1, MetricLoggerUnit.Count)
        throw error
      }
    )
  }

  override getNetwork(): Promise<Network> {
    metric.putMetric(`RPC_${this.name}_GETNETWORK_REQUESTED`, 1, MetricLoggerUnit.Count)
    return super.getNetwork().then(
      (response) => {
        metric.putMetric(`RPC_${this.name}_GETNETWORK_SUCCESS`, 1, MetricLoggerUnit.Count)
        return response
      },
      (error) => {
        metric.putMetric(`RPC_${this.name}_GETNETWORK_FAILURE`, 1, MetricLoggerUnit.Count)
        throw error
      }
    )
  }

  override getStorageAt(
    addressOrName: string | Promise<string>,
    position: BigNumberish | Promise<BigNumberish>,
    blockTag?: BlockTag | Promise<BlockTag>
  ): Promise<string> {
    metric.putMetric(`RPC_${this.name}_GETSTORAGEAT_REQUESTED`, 1, MetricLoggerUnit.Count)
    return super.getStorageAt(addressOrName, position, blockTag).then(
      (response) => {
        metric.putMetric(`RPC_${this.name}_GETSTORAGEAT_SUCCESS`, 1, MetricLoggerUnit.Count)
        return response
      },
      (error) => {
        metric.putMetric(`RPC_${this.name}_GETSTORAGEAT_FAILURE`, 1, MetricLoggerUnit.Count)
        throw error
      }
    )
  }

  override getTransaction(transactionHash: string): Promise<TransactionResponse> {
    metric.putMetric(`RPC_${this.name}_GETTRANSACTION_REQUESTED`, 1, MetricLoggerUnit.Count)
    return super.getTransaction(transactionHash).then(
      (response) => {
        metric.putMetric(`RPC_${this.name}_GETTRANSACTION_SUCCESS`, 1, MetricLoggerUnit.Count)
        return response
      },
      (error) => {
        metric.putMetric(`RPC_${this.name}_GETTRANSACTION_FAILURE`, 1, MetricLoggerUnit.Count)
        throw error
      }
    )
  }

  override getTransactionCount(
    addressOrName: string | Promise<string>,
    blockTag?: BlockTag | Promise<BlockTag>
  ): Promise<number> {
    metric.putMetric(`RPC_${this.name}_GETTRANSACTIONCOUNT_REQUESTED`, 1, MetricLoggerUnit.Count)
    return super.getTransactionCount(addressOrName, blockTag).then(
      (response) => {
        metric.putMetric(`RPC_${this.name}_GETTRANSACTIONCOUNT_SUCCESS`, 1, MetricLoggerUnit.Count)
        return response
      },
      (error) => {
        metric.putMetric(`RPC_${this.name}_GETTRANSACTIONCOUNT_FAILURE`, 1, MetricLoggerUnit.Count)
        throw error
      }
    )
  }

  override getTransactionReceipt(transactionHash: string): Promise<TransactionReceipt> {
    metric.putMetric(`RPC_${this.name}_GETTRANSACTIONRECEIPT_REQUESTED`, 1, MetricLoggerUnit.Count)
    return super.getTransactionReceipt(transactionHash).then(
      (response) => {
        metric.putMetric(`RPC_${this.name}_GETTRANSACTIONRECEIPT_SUCCESS`, 1, MetricLoggerUnit.Count)
        return response
      },
      (error) => {
        metric.putMetric(`RPC_${this.name}_GETTRANSACTIONRECEIPT_FAILURE`, 1, MetricLoggerUnit.Count)
        throw error
      }
    )
  }

  override listenerCount(eventName?: EventType): number {
    return super.listenerCount(eventName)
  }

  override listeners(eventName?: EventType): Array<Listener> {
    return super.listeners(eventName)
  }

  override lookupAddress(address: string | Promise<string>): Promise<string | null> {
    metric.putMetric(`RPC_${this.name}_LOOKUPADDRESS_REQUESTED`, 1, MetricLoggerUnit.Count)
    return super.lookupAddress(address).then(
      (response) => {
        metric.putMetric(`RPC_${this.name}_LOOKUPADDRESS_SUCCESS`, 1, MetricLoggerUnit.Count)
        return response
      },
      (error) => {
        metric.putMetric(`RPC_${this.name}_LOOKUPADDRESS_FAILURE`, 1, MetricLoggerUnit.Count)
        throw error
      }
    )
  }

  override resolveName(name: string | Promise<string>): Promise<string | null> {
    metric.putMetric(`RPC_${this.name}_RESOLVENAME_REQUESTED`, 1, MetricLoggerUnit.Count)
    return super.resolveName(name).then(
      (response) => {
        metric.putMetric(`RPC_${this.name}_RESOLVENAME_SUCCESS`, 1, MetricLoggerUnit.Count)
        return response
      },
      (error) => {
        metric.putMetric(`RPC_${this.name}_RESOLVENAME_FAILURE`, 1, MetricLoggerUnit.Count)
        throw error
      }
    )
  }

  override sendTransaction(signedTransaction: string | Promise<string>): Promise<TransactionResponse> {
    metric.putMetric(`RPC_${this.name}_SENDTRANSACTION_REQUESTED`, 1, MetricLoggerUnit.Count)
    return super.sendTransaction(signedTransaction).then(
      (response) => {
        metric.putMetric(`RPC_${this.name}_SENDTRANSACTION_SUCCESS`, 1, MetricLoggerUnit.Count)
        return response
      },
      (error) => {
        metric.putMetric(`RPC_${this.name}_SENDTRANSACTION_FAILURE`, 1, MetricLoggerUnit.Count)
        throw error
      }
    )
  }

  override waitForTransaction(
    transactionHash: string,
    confirmations?: number,
    timeout?: number
  ): Promise<TransactionReceipt> {
    metric.putMetric(`RPC_${this.name}_WAITFORTRANSACTION_REQUESTED`, 1, MetricLoggerUnit.Count)
    return super.waitForTransaction(transactionHash, confirmations, timeout).then(
      (response) => {
        metric.putMetric(`RPC_${this.name}_WAITFORTRANSACTION_SUCCESS`, 1, MetricLoggerUnit.Count)
        return response
      },
      (error) => {
        metric.putMetric(`RPC_${this.name}_WAITFORTRANSACTION_FAILURE`, 1, MetricLoggerUnit.Count)
        throw error
      }
    )
  }
}
