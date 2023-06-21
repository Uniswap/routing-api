import { ethers } from 'ethers'
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
import { Network } from '@ethersproject/networks'
import { Deferrable } from '@ethersproject/properties'
import { ChainId } from '@uniswap/smart-order-router'
import { BigNumber, BigNumberish } from '@ethersproject/bignumber'

export type EVMClientProps = {
  infuraProvider: ethers.providers.JsonRpcProvider
  chainId: ChainId
}

export class EVMClient extends ethers.providers.BaseProvider {
  private infuraProvider: ethers.providers.JsonRpcProvider

  // delegate all non-private method calls
  constructor({ infuraProvider, chainId }: EVMClientProps) {
    super(chainId)
    this.infuraProvider = infuraProvider
  }

  override call(transaction: Deferrable<TransactionRequest>, blockTag?: BlockTag | Promise<BlockTag>): Promise<string> {
    return this.infuraProvider.call(transaction, blockTag)
  }

  override emit(eventName: EventType, ...args: Array<any>): boolean {
    return this.infuraProvider.emit(eventName, ...args)
  }

  override estimateGas(transaction: Deferrable<TransactionRequest>): Promise<BigNumber> {
    return this.infuraProvider.estimateGas(transaction)
  }

  override getBalance(
    addressOrName: string | Promise<string>,
    blockTag?: BlockTag | Promise<BlockTag>
  ): Promise<BigNumber> {
    return this.infuraProvider.getBalance(addressOrName, blockTag)
  }

  override getBlock(blockHashOrBlockTag: BlockTag | string | Promise<BlockTag | string>): Promise<Block> {
    return this.infuraProvider.getBlock(blockHashOrBlockTag)
  }

  override getBlockNumber(): Promise<number> {
    return this.infuraProvider.getBlockNumber()
  }

  override getBlockWithTransactions(
    blockHashOrBlockTag: BlockTag | string | Promise<BlockTag | string>
  ): Promise<BlockWithTransactions> {
    return this.infuraProvider.getBlockWithTransactions(blockHashOrBlockTag)
  }

  override getCode(addressOrName: string | Promise<string>, blockTag?: BlockTag | Promise<BlockTag>): Promise<string> {
    return this.infuraProvider.getCode(addressOrName, blockTag)
  }

  override getGasPrice(): Promise<BigNumber> {
    return this.infuraProvider.getGasPrice()
  }

  override getLogs(filter: Filter): Promise<Array<Log>> {
    return this.infuraProvider.getLogs(filter)
  }

  override getNetwork(): Promise<Network> {
    return this.infuraProvider.getNetwork()
  }

  override getStorageAt(
    addressOrName: string | Promise<string>,
    position: BigNumberish | Promise<BigNumberish>,
    blockTag?: BlockTag | Promise<BlockTag>
  ): Promise<string> {
    return this.infuraProvider.getStorageAt(addressOrName, position, blockTag)
  }

  override getTransaction(transactionHash: string): Promise<TransactionResponse> {
    return this.infuraProvider.getTransaction(transactionHash)
  }

  override getTransactionCount(
    addressOrName: string | Promise<string>,
    blockTag?: BlockTag | Promise<BlockTag>
  ): Promise<number> {
    return this.infuraProvider.getTransactionCount(addressOrName, blockTag)
  }

  override getTransactionReceipt(transactionHash: string): Promise<TransactionReceipt> {
    return this.infuraProvider.getTransactionReceipt(transactionHash)
  }

  override listenerCount(eventName?: EventType): number {
    return this.infuraProvider.listenerCount(eventName)
  }

  override listeners(eventName?: EventType): Array<Listener> {
    return this.infuraProvider.listeners(eventName)
  }

  override lookupAddress(address: string | Promise<string>): Promise<string | null> {
    return this.infuraProvider.lookupAddress(address)
  }

  override off(eventName: EventType, listener?: Listener): this {
    this.infuraProvider.off(eventName, listener)

    return this
  }

  override on(eventName: EventType, listener: Listener): this {
    this.infuraProvider.on(eventName, listener)

    return this
  }

  override once(eventName: EventType, listener: Listener): this {
    this.infuraProvider.once(eventName, listener)

    return this
  }

  override removeAllListeners(eventName?: EventType): this {
    this.infuraProvider.removeAllListeners(eventName)

    return this
  }

  override resolveName(name: string | Promise<string>): Promise<string | null> {
    return this.infuraProvider.resolveName(name)
  }

  override sendTransaction(signedTransaction: string | Promise<string>): Promise<TransactionResponse> {
    return this.infuraProvider.sendTransaction(signedTransaction)
  }

  override waitForTransaction(
    transactionHash: string,
    confirmations?: number,
    timeout?: number
  ): Promise<TransactionReceipt> {
    return this.infuraProvider.waitForTransaction(transactionHash, confirmations, timeout)
  }
}
