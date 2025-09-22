import { ethers } from "ethers"
import { GlobalRpcProviders } from "../../lib/rpc/GlobalRpcProviders"
import { ChainId } from "@juiceswapxyz/sdk-core"
import { default as Logger } from "bunyan"

// Gas configuration - will be fetched dynamically
const DEFAULT_MAX_FEE_PER_GAS = "0x1dcd6500" // 500 gwei fallback
const DEFAULT_MAX_PRIORITY_FEE_PER_GAS = "0x3b9aca00" // 1 gwei fallback

export function getGlobalRpcProvider(chainId: number): any {
    // Create logger
    const log = Logger.createLogger({
        name: 'SwapHandler',
        serializers: Logger.stdSerializers,
        level: Logger.INFO,
    })

    // Get provider using the same system as the existing codebase
    let provider: ethers.providers.StaticJsonRpcProvider

    if (GlobalRpcProviders.getGlobalUniRpcProviders(log).has(chainId as ChainId)) {
        // Use RPC gateway (preferred method)
        provider = GlobalRpcProviders.getGlobalUniRpcProviders(log).get(chainId as ChainId)!
    } else {
        // Fallback to direct RPC URL
        const url = process.env[`WEB3_RPC_${chainId}`]
        if (!url) {
            return;
        }
        provider = new ethers.providers.StaticJsonRpcProvider(url)
    }

    return provider
}

// Function to get current gas prices from the network
export async function getGasPrices(provider: ethers.providers.JsonRpcProvider): Promise<{
    maxFeePerGas: string
    maxPriorityFeePerGas: string
  }> {
    try {
      // Get current gas price
      const gasPrice = await provider.getGasPrice()
      
      // Get fee history to estimate priority fee
      const feeHistory = await provider.getFeeData()
      
      let maxFeePerGas: string
      let maxPriorityFeePerGas: string
      
      if (feeHistory.maxFeePerGas && feeHistory.maxPriorityFeePerGas) {
        // Use EIP-1559 gas prices if available
        maxFeePerGas = feeHistory.maxFeePerGas.toHexString()
        maxPriorityFeePerGas = feeHistory.maxPriorityFeePerGas.toHexString()
      } else {
        // Fallback to legacy gas price with buffer
        const gasPriceWithBuffer = gasPrice.mul(120).div(100) // 20% buffer
        maxFeePerGas = gasPriceWithBuffer.toHexString()
        maxPriorityFeePerGas = gasPrice.mul(10).div(100).toHexString() // 10% of gas price as priority fee
      }
      
      return {
        maxFeePerGas,
        maxPriorityFeePerGas
      }
    } catch (error) {
      console.warn("Failed to fetch gas prices, using defaults:", error)
      return {
        maxFeePerGas: DEFAULT_MAX_FEE_PER_GAS,
        maxPriorityFeePerGas: DEFAULT_MAX_PRIORITY_FEE_PER_GAS
      }
    }
  }

