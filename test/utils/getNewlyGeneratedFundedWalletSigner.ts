import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Wallet } from '@ethersproject/wallet'
import hre from 'hardhat'

const { ethers } = hre

// Hardhat's default signers are well-known addresses that can be delegated on
// mainnet by anyone. Instead of hoping one stays non-delegated, generate a
// fresh random wallet — a brand-new address with a private key is guaranteed
// to have no on-chain code (no delegation) and supports _signTypedData.
export const getNewlyGeneratedFundedWalletSigner = async (): Promise<SignerWithAddress> => {
  const wallet = Wallet.createRandom().connect(ethers.provider)

  // Set the balance directly — avoids gas costs eating into the funded amount
  await hre.network.provider.request({
    method: 'hardhat_setBalance',
    params: [wallet.address, '0x21E19E0C9BAB2400000'], // 10,000 ETH
  })

  console.log(`generated fresh non-delegated test wallet: ${wallet.address}`)

  // Wallet has the same interface as SignerWithAddress (address, sendTransaction,
  // _signTypedData, etc.) and owns its private key — unlike impersonated accounts.
  return wallet as unknown as SignerWithAddress
}
