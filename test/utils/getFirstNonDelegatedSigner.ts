import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { getCurrentDelegationAddress } from './getCurrentDelegationAddress'
import { StaticJsonRpcProvider } from '@ethersproject/providers'

const l1RpcProvider = new StaticJsonRpcProvider(process.env.ARCHIVE_NODE_RPC, 1)

// modified from https://github.com/Uniswap/external-api/blob/1283bababf5a61bb64ccae0401c4f25dc3fa36d2/lib/handlers/wallet-delegation/WalletCheckDelegationHandler.ts#L38
// we are hoping that under test mnemonic from hardhat,
// there are still test wallets that are not delegated, out of all 20 test wallets
export const getFirstNonDelegatedSigner = async (signers: SignerWithAddress[]): Promise<SignerWithAddress> => {
  let firstNonDelegatedSigner: SignerWithAddress | undefined

  for (const signer of signers) {
    const code = await l1RpcProvider.getCode(signer.address)
    if (getCurrentDelegationAddress(code) === null) {
      firstNonDelegatedSigner = signer
      break
    }
  }

  console.log(`first non-delegated test wallet is ${JSON.stringify(firstNonDelegatedSigner)}`)

  return firstNonDelegatedSigner ?? signers[0]
}
