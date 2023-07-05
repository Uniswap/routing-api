import { ethers } from 'ethers'

export class EVMClient extends ethers.providers.JsonRpcProvider {
  private infuraProvider: ethers.providers.JsonRpcProvider

  // delegate all non-private method calls
}