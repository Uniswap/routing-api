import { ethers } from 'ethers'
import { Deferrable } from '@ethersproject/properties'
import { Listener, TransactionRequest } from '@ethersproject/providers'
import {
  Block,
  BlockTag,
  BlockWithTransactions,
  EventType,
  Filter,
  Log, TransactionReceipt,
  TransactionResponse
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

  constructor({ url, network, name } : InstrumentedEVMProviderProps) {
    super(url, network)
    this.name = name
  }

  override call(transaction: Deferrable<TransactionRequest>, blockTag?: BlockTag | Promise<BlockTag>): Promise<string> {
    metric.putMetric(`RPC_${this.name}_CALL_REQUESTED`, 1, MetricLoggerUnit.Count)
    return super.call(transaction, blockTag).then(response => {
      metric.putMetric(`RPC_${this.name}_CALL_SUCCESS`, 1, MetricLoggerUnit.Count)
      return response
    }, error => {
      metric.putMetric(`RPC_${this.name}_CALL_FAILURE`, 1, MetricLoggerUnit.Count)
      throw error
    });
  }

  override emit(eventName: EventType, ...args: Array<any>): boolean {
    return super.emit(eventName, ...args)
  }

  override estimateGas(transaction: Deferrable<TransactionRequest>): Promise<BigNumber> {
    return super.estimateGas(transaction)
  }

  override getBalance(
    addressOrName: string | Promise<string>,
    blockTag?: BlockTag | Promise<BlockTag>
  ): Promise<BigNumber> {
    return super.getBalance(addressOrName, blockTag)
  }

  override getBlock(blockHashOrBlockTag: BlockTag | string | Promise<BlockTag | string>): Promise<Block> {
    return super.getBlock(blockHashOrBlockTag)
  }

  override getBlockNumber(): Promise<number> {
    return super.getBlockNumber()
  }

  override getBlockWithTransactions(
    blockHashOrBlockTag: BlockTag | string | Promise<BlockTag | string>
  ): Promise<BlockWithTransactions> {
    return super.getBlockWithTransactions(blockHashOrBlockTag)
  }

  override getCode(addressOrName: string | Promise<string>, blockTag?: BlockTag | Promise<BlockTag>): Promise<string> {
    return super.getCode(addressOrName, blockTag)
  }

  override getGasPrice(): Promise<BigNumber> {
    return super.getGasPrice()
  }

  override getLogs(filter: Filter): Promise<Array<Log>> {
    return super.getLogs(filter)
  }

  override getNetwork(): Promise<Network> {
    return super.getNetwork()
  }

  override getStorageAt(
    addressOrName: string | Promise<string>,
    position: BigNumberish | Promise<BigNumberish>,
    blockTag?: BlockTag | Promise<BlockTag>
  ): Promise<string> {
    return super.getStorageAt(addressOrName, position, blockTag)
  }

  override getTransaction(transactionHash: string): Promise<TransactionResponse> {
    return super.getTransaction(transactionHash)
  }

  override getTransactionCount(
    addressOrName: string | Promise<string>,
    blockTag?: BlockTag | Promise<BlockTag>
  ): Promise<number> {
    return super.getTransactionCount(addressOrName, blockTag)
  }

  override getTransactionReceipt(transactionHash: string): Promise<TransactionReceipt> {
    return super.getTransactionReceipt(transactionHash)
  }

  override listenerCount(eventName?: EventType): number {
    return super.listenerCount(eventName)
  }

  override listeners(eventName?: EventType): Array<Listener> {
    return super.listeners(eventName)
  }

  override lookupAddress(address: string | Promise<string>): Promise<string | null> {
    return super.lookupAddress(address)
  }

  override off(eventName: EventType, listener?: Listener): this {
    super.off(eventName, listener)

    return this
  }

  override on(eventName: EventType, listener: Listener): this {
    super.on(eventName, listener)

    return this
  }

  override once(eventName: EventType, listener: Listener): this {
    super.once(eventName, listener)

    return this
  }

  override removeAllListeners(eventName?: EventType): this {
    super.removeAllListeners(eventName)

    return this
  }

  override resolveName(name: string | Promise<string>): Promise<string | null> {
    return super.resolveName(name)
  }

  override sendTransaction(signedTransaction: string | Promise<string>): Promise<TransactionResponse> {
    return super.sendTransaction(signedTransaction)
  }

  override waitForTransaction(
    transactionHash: string,
    confirmations?: number,
    timeout?: number
  ): Promise<TransactionReceipt> {
    return super.waitForTransaction(transactionHash, confirmations, timeout)
  }
}