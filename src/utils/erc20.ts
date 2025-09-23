import { ADDRESS_ZERO } from "@juiceswapxyz/v3-sdk";
import { WETH9 } from "@juiceswapxyz/sdk-core";
import { ethers } from "ethers";

const ERC20ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) returns (uint256)",
  "function decimals() returns (uint8)"
]

export const getTokenAddress = (token: string, chainId: number) => {
    return token === ADDRESS_ZERO ? WETH9[chainId].address : token;
}

export interface ApprovalTransaction {
  to: string
  value: string
  from: string
  data: string
  gasLimit: string
  chainId: number
}

export const getApproveTxForToken = async (
  token: string, 
  amount: string, 
  walletAddress: string, 
  spender: string, 
  provider: ethers.providers.JsonRpcProvider,
  chainId: number
): Promise<ApprovalTransaction | null> => {
  // 1. if token is ZERO_ADDRESS, return null (native tokens don't need approval)
  if (token === ADDRESS_ZERO) {
    return null
  }

  try {
    // Use direct call to avoid gas estimation issues
    const tokenInterface = new ethers.utils.Interface(ERC20ABI)
    const callData = tokenInterface.encodeFunctionData("allowance", [walletAddress, spender])
    
    const result = await provider.call({
      to: token,
      data: callData
    })

    const allowance = ethers.BigNumber.from(result)
    
    if (allowance.gte(amount)) {
      return null // Already approved
    }
  } catch (error) {
    console.error(`Error checking allowance for token ${token}:`, error)
    // Continue to return approval transaction if we can't check allowance
  }

  const tokenContract = new ethers.Contract(token, ERC20ABI, provider)

  // 3. prepare transaction data (don't estimate gas as it requires a signer)
  try {
    return {
      to: token,
      value: "0x00",
      from: walletAddress,
      data: tokenContract.interface.encodeFunctionData("approve", [spender, amount]),
      gasLimit: "60000", // Standard gas limit for ERC20 approve
      chainId
    }
  } catch (error) {
    console.error(`Error encoding approval transaction for token ${token}:`, error)
    throw error
  }
}

export const fetchTokenDetails = async (token: string, provider: ethers.providers.JsonRpcProvider) => {
  const tokenContract = new ethers.Contract(token, ERC20ABI, provider)
  const decimals = await tokenContract.decimals()
  return { decimals }
}