import { ethers } from 'ethers'

export interface EVMClient {
  getProvider(): ethers.providers.BaseProvider
}

export type EVMClientProps = {
  allProviders: Array<ethers.providers.BaseProvider>
}

export class DefaultEVMClient implements EVMClient {
  private readonly allProviders: Array<ethers.providers.BaseProvider>

  // delegate all non-private method calls
  constructor({ allProviders }: EVMClientProps) {
    this.allProviders = allProviders
  }

  getProvider(): ethers.providers.BaseProvider {
    // TODO: use strategy pattern to have heuristics selecting which provider
    return this.allProviders[0]
  }
}
