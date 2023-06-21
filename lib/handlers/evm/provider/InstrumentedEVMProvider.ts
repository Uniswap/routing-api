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
    metric.putMetric(`RPC_${this.name}_${this.network.name}CALL_REQUESTED`, 1, MetricLoggerUnit.Count)
    return super.call(transaction, blockTag).then(
      (response) => {
        metric.putMetric(`RPC_${this.name}_${this.network.name}CALL_SUCCESS`, 1, MetricLoggerUnit.Count)
        return response
      },
      (error) => {
        metric.putMetric(`RPC_${this.name}_${this.network.name}CALL_FAILURE`, 1, MetricLoggerUnit.Count)
        throw error
      }
    )
  }

  override estimateGas(transaction: Deferrable<TransactionRequest>): Promise<BigNumber> {
    metric.putMetric(`RPC_${this.name}_${this.network.name}ESTIMATEGAS_REQUESTED`, 1, MetricLoggerUnit.Count)
    return super.estimateGas(transaction).then(
      (response) => {
        metric.putMetric(`RPC_${this.name}_${this.network.name}ESTIMATEGAS_SUCCESS`, 1, MetricLoggerUnit.Count)
        return response
      },
      (error) => {
        metric.putMetric(`RPC_${this.name}_${this.network.name}ESTIMATEGAS_FAILURE`, 1, MetricLoggerUnit.Count)
        throw error
      }
    )
  }

  override getBalance(
    addressOrName: string | Promise<string>,
    blockTag?: BlockTag | Promise<BlockTag>
  ): Promise<BigNumber> {
    metric.putMetric(`RPC_${this.name}_${this.network.name}GETBALANCE_REQUESTED`, 1, MetricLoggerUnit.Count)
    return super.getBalance(addressOrName, blockTag).then(
      (response) => {
        metric.putMetric(`RPC_${this.name}_${this.network.name}GETBALANCE_SUCCESS`, 1, MetricLoggerUnit.Count)
        return response
      },
      (error) => {
        metric.putMetric(`RPC_${this.name}_${this.network.name}GETBALANCE_FAILURE`, 1, MetricLoggerUnit.Count)
        throw error
      }
    )
  }

  override getBlock(blockHashOrBlockTag: BlockTag | string | Promise<BlockTag | string>): Promise<Block> {
    metric.putMetric(`RPC_${this.name}_${this.network.name}GETBLOCK_REQUESTED`, 1, MetricLoggerUnit.Count)
    return super.getBlock(blockHashOrBlockTag).then(
      (response) => {
        metric.putMetric(`RPC_${this.name}_${this.network.name}GETBLOCK_SUCCESS`, 1, MetricLoggerUnit.Count)
        return response
      },
      (error) => {
        metric.putMetric(`RPC_${this.name}_${this.network.name}GETBLOCK_FAILURE`, 1, MetricLoggerUnit.Count)
        throw error
      }
    )
  }

  override getBlockNumber(): Promise<number> {
    metric.putMetric(`RPC_${this.name}_${this.network.name}GETBLOCKNUMBER_REQUESTED`, 1, MetricLoggerUnit.Count)
    return super.getBlockNumber().then(
      (response) => {
        metric.putMetric(`RPC_${this.name}_${this.network.name}GETBLOCKNUMBER_SUCCESS`, 1, MetricLoggerUnit.Count)
        return response
      },
      (error) => {
        metric.putMetric(`RPC_${this.name}_${this.network.name}GETBLOCKNUMBER_FAILURE`, 1, MetricLoggerUnit.Count)
        throw error
      }
    )
  }

  override getBlockWithTransactions(
    blockHashOrBlockTag: BlockTag | string | Promise<BlockTag | string>
  ): Promise<BlockWithTransactions> {
    metric.putMetric(`RPC_${this.name}_${this.network.name}GETBLOCKWITHTRANSACTION_REQUESTED`, 1, MetricLoggerUnit.Count)
    return super.getBlockWithTransactions(blockHashOrBlockTag).then(
      (response) => {
        metric.putMetric(`RPC_${this.name}_${this.network.name}GETBLOCKWITHTRANSACTION_SUCCESS`, 1, MetricLoggerUnit.Count)
        return response
      },
      (error) => {
        metric.putMetric(`RPC_${this.name}_${this.network.name}GETBLOCKWITHTRANSACTION_FAILURE`, 1, MetricLoggerUnit.Count)
        throw error
      }
    )
  }

  override getCode(addressOrName: string | Promise<string>, blockTag?: BlockTag | Promise<BlockTag>): Promise<string> {
    metric.putMetric(`RPC_${this.name}_${this.network.name}GETCODE_REQUESTED`, 1, MetricLoggerUnit.Count)
    return super.getCode(addressOrName, blockTag).then(
      (response) => {
        metric.putMetric(`RPC_${this.name}_${this.network.name}GETCODE_SUCCESS`, 1, MetricLoggerUnit.Count)
        return response
      },
      (error) => {
        metric.putMetric(`RPC_${this.name}_${this.network.name}GETCODE_FAILURE`, 1, MetricLoggerUnit.Count)
        throw error
      }
    )
  }

  override getGasPrice(): Promise<BigNumber> {
    metric.putMetric(`RPC_${this.name}_${this.network.name}GETGASPRICE_REQUESTED`, 1, MetricLoggerUnit.Count)
    return super.getGasPrice().then(
      (response) => {
        metric.putMetric(`RPC_${this.name}_${this.network.name}GETGASPRICE_SUCCESS`, 1, MetricLoggerUnit.Count)
        return response
      },
      (error) => {
        metric.putMetric(`RPC_${this.name}_${this.network.name}GETGASPRICE_FAILURE`, 1, MetricLoggerUnit.Count)
        throw error
      }
    )
  }

  override getLogs(filter: Filter): Promise<Array<Log>> {
    metric.putMetric(`RPC_${this.name}_${this.network.name}GETLOGS_REQUESTED`, 1, MetricLoggerUnit.Count)
    return super.getLogs(filter).then(
      (response) => {
        metric.putMetric(`RPC_${this.name}_${this.network.name}GETLOGS_SUCCESS`, 1, MetricLoggerUnit.Count)
        return response
      },
      (error) => {
        metric.putMetric(`RPC_${this.name}_${this.network.name}GETLOGS_FAILURE`, 1, MetricLoggerUnit.Count)
        throw error
      }
    )
  }

  override getNetwork(): Promise<Network> {
    metric.putMetric(`RPC_${this.name}_${this.network.name}GETNETWORK_REQUESTED`, 1, MetricLoggerUnit.Count)
    return super.getNetwork().then(
      (response) => {
        metric.putMetric(`RPC_${this.name}_${this.network.name}GETNETWORK_SUCCESS`, 1, MetricLoggerUnit.Count)
        return response
      },
      (error) => {
        metric.putMetric(`RPC_${this.name}_${this.network.name}GETNETWORK_FAILURE`, 1, MetricLoggerUnit.Count)
        throw error
      }
    )
  }

  override getStorageAt(
    addressOrName: string | Promise<string>,
    position: BigNumberish | Promise<BigNumberish>,
    blockTag?: BlockTag | Promise<BlockTag>
  ): Promise<string> {
    metric.putMetric(`RPC_${this.name}_${this.network.name}GETSTORAGEAT_REQUESTED`, 1, MetricLoggerUnit.Count)
    return super.getStorageAt(addressOrName, position, blockTag).then(
      (response) => {
        metric.putMetric(`RPC_${this.name}_${this.network.name}GETSTORAGEAT_SUCCESS`, 1, MetricLoggerUnit.Count)
        return response
      },
      (error) => {
        metric.putMetric(`RPC_${this.name}_${this.network.name}GETSTORAGEAT_FAILURE`, 1, MetricLoggerUnit.Count)
        throw error
      }
    )
  }

  override getTransaction(transactionHash: string): Promise<TransactionResponse> {
    metric.putMetric(`RPC_${this.name}_${this.network.name}GETTRANSACTION_REQUESTED`, 1, MetricLoggerUnit.Count)
    return super.getTransaction(transactionHash).then(
      (response) => {
        metric.putMetric(`RPC_${this.name}_${this.network.name}GETTRANSACTION_SUCCESS`, 1, MetricLoggerUnit.Count)
        return response
      },
      (error) => {
        metric.putMetric(`RPC_${this.name}_${this.network.name}GETTRANSACTION_FAILURE`, 1, MetricLoggerUnit.Count)
        throw error
      }
    )
  }

  override getTransactionCount(
    addressOrName: string | Promise<string>,
    blockTag?: BlockTag | Promise<BlockTag>
  ): Promise<number> {
    metric.putMetric(`RPC_${this.name}_${this.network.name}GETTRANSACTIONCOUNT_REQUESTED`, 1, MetricLoggerUnit.Count)
    return super.getTransactionCount(addressOrName, blockTag).then(
      (response) => {
        metric.putMetric(`RPC_${this.name}_${this.network.name}GETTRANSACTIONCOUNT_SUCCESS`, 1, MetricLoggerUnit.Count)
        return response
      },
      (error) => {
        metric.putMetric(`RPC_${this.name}_${this.network.name}GETTRANSACTIONCOUNT_FAILURE`, 1, MetricLoggerUnit.Count)
        throw error
      }
    )
  }

  override getTransactionReceipt(transactionHash: string): Promise<TransactionReceipt> {
    metric.putMetric(`RPC_${this.name}_${this.network.name}GETTRANSACTIONRECEIPT_REQUESTED`, 1, MetricLoggerUnit.Count)
    return super.getTransactionReceipt(transactionHash).then(
      (response) => {
        metric.putMetric(`RPC_${this.name}_${this.network.name}GETTRANSACTIONRECEIPT_SUCCESS`, 1, MetricLoggerUnit.Count)
        return response
      },
      (error) => {
        metric.putMetric(`RPC_${this.name}_${this.network.name}GETTRANSACTIONRECEIPT_FAILURE`, 1, MetricLoggerUnit.Count)
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
    metric.putMetric(`RPC_${this.name}_${this.network.name}LOOKUPADDRESS_REQUESTED`, 1, MetricLoggerUnit.Count)
    return super.lookupAddress(address).then(
      (response) => {
        metric.putMetric(`RPC_${this.name}_${this.network.name}LOOKUPADDRESS_SUCCESS`, 1, MetricLoggerUnit.Count)
        return response
      },
      (error) => {
        metric.putMetric(`RPC_${this.name}_${this.network.name}LOOKUPADDRESS_FAILURE`, 1, MetricLoggerUnit.Count)
        throw error
      }
    )
  }

  override resolveName(name: string | Promise<string>): Promise<string | null> {
    metric.putMetric(`RPC_${this.name}_${this.network.name}RESOLVENAME_REQUESTED`, 1, MetricLoggerUnit.Count)
    return super.resolveName(name).then(
      (response) => {
        metric.putMetric(`RPC_${this.name}_${this.network.name}RESOLVENAME_SUCCESS`, 1, MetricLoggerUnit.Count)
        return response
      },
      (error) => {
        metric.putMetric(`RPC_${this.name}_${this.network.name}RESOLVENAME_FAILURE`, 1, MetricLoggerUnit.Count)
        throw error
      }
    )
  }

  override sendTransaction(signedTransaction: string | Promise<string>): Promise<TransactionResponse> {
    metric.putMetric(`RPC_${this.name}_${this.network.name}SENDTRANSACTION_REQUESTED`, 1, MetricLoggerUnit.Count)
    return super.sendTransaction(signedTransaction).then(
      (response) => {
        metric.putMetric(`RPC_${this.name}_${this.network.name}SENDTRANSACTION_SUCCESS`, 1, MetricLoggerUnit.Count)
        return response
      },
      (error) => {
        metric.putMetric(`RPC_${this.name}_${this.network.name}SENDTRANSACTION_FAILURE`, 1, MetricLoggerUnit.Count)
        throw error
      }
    )
  }

  override waitForTransaction(
    transactionHash: string,
    confirmations?: number,
    timeout?: number
  ): Promise<TransactionReceipt> {
    metric.putMetric(`RPC_${this.name}_${this.network.name}WAITFORTRANSACTION_REQUESTED`, 1, MetricLoggerUnit.Count)
    return super.waitForTransaction(transactionHash, confirmations, timeout).then(
      (response) => {
        metric.putMetric(`RPC_${this.name}_${this.network.name}WAITFORTRANSACTION_SUCCESS`, 1, MetricLoggerUnit.Count)
        return response
      },
      (error) => {
        metric.putMetric(`RPC_${this.name}_${this.network.name}WAITFORTRANSACTION_FAILURE`, 1, MetricLoggerUnit.Count)
        throw error
      }
    )
  }
}
