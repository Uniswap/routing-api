import { ethers } from 'ethers'

export interface EVMClient {
  getProvider(): ethers.providers.JsonRpcProvider
}

export type EVMClientProps = {
  allProviders: Array<ethers.providers.JsonRpcProvider>
}

export class DefaultEVMClient implements EVMClient {
  private readonly allProviders: Array<ethers.providers.JsonRpcProvider>

  // delegate all non-private method calls
  constructor({ allProviders }: EVMClientProps) {
    this.allProviders = allProviders
  }

  getProvider(): ethers.providers.JsonRpcProvider {
    // TODO: use strategy pattern to have heuristics selecting which provider
    return this.allProviders[0]
  }
}
