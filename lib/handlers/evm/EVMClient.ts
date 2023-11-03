import { ethers } from 'ethers'

export interface EVMClient {
  getProvider(): ethers.providers.StaticJsonRpcProvider
}

export type EVMClientProps = {
  allProviders: Array<ethers.providers.StaticJsonRpcProvider>
}

export class DefaultEVMClient implements EVMClient {
  private readonly allProviders: Array<ethers.providers.StaticJsonRpcProvider>

  // delegate all non-private method calls
  constructor({ allProviders }: EVMClientProps) {
    this.allProviders = allProviders
  }

  getProvider(): ethers.providers.StaticJsonRpcProvider {
    // TODO: use strategy pattern to have heuristics selecting which provider
    return this.allProviders[0]
  }
}
