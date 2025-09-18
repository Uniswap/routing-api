import { Request, Response } from "express"
import { AlphaRouter } from '@juiceswapxyz/smart-order-router'
import { SwapOptionsSwapRouter02, SwapType } from '@juiceswapxyz/smart-order-router'
import { CurrencyAmount, TradeType, Token, Percent, ChainId } from '@juiceswapxyz/sdk-core'
import { ethers } from 'ethers'
import JSBI from 'jsbi'
import { GlobalRpcProviders } from '../../lib/rpc/GlobalRpcProviders'
import Logger from 'bunyan'

// V3 Swap Router addresses for different chains
const V3_SWAP_ROUTER_ADDRESSES = {
  1: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45", // Mainnet
  11155111: "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E", // Sepolia
  10: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45", // Optimism
  137: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45", // Polygon
  42161: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45", // Arbitrum
  8453: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45", // Base
}

// Gas configuration - will be fetched dynamically
const DEFAULT_MAX_FEE_PER_GAS = "0x1dcd6500" // 500 gwei fallback
const DEFAULT_MAX_PRIORITY_FEE_PER_GAS = "0x3b9aca00" // 1 gwei fallback

interface SwapRequest {
  tokenInAddress: string
  tokenInChainId: number
  tokenInDecimals: number
  tokenOutAddress: string
  tokenOutChainId: number
  tokenOutDecimals: number
  amount: string
  type: 'exactIn' | 'exactOut'
  recipient: string
  slippageTolerance: string
  deadline?: string
  chainId: number
  from: string
}

interface SwapResponse {
  data: string
  to: string
  value: string
  from: string
  maxFeePerGas: string
  maxPriorityFeePerGas: string
}

// Function to get current gas prices from the network
async function getGasPrices(provider: ethers.providers.JsonRpcProvider): Promise<{
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


export async function handleSwap(req: Request, res: Response): Promise<void> {
  try {
    const { 
      tokenInAddress, 
      tokenInChainId,
      tokenInDecimals,
      tokenOutAddress, 
      tokenOutChainId, 
      tokenOutDecimals,
      amount, 
      type, 
      recipient, 
      slippageTolerance, 
      deadline,
      chainId, 
      from 
    }: SwapRequest = req.body

    // Validate required fields
    const missingFields = []
    if (!tokenInAddress) missingFields.push('tokenInAddress')
    if (!tokenOutAddress) missingFields.push('tokenOutAddress')
    if (!amount) missingFields.push('amount')
    if (!type) missingFields.push('type')
    if (!recipient) missingFields.push('recipient')
    if (!slippageTolerance) missingFields.push('slippageTolerance')
    if (tokenInDecimals === undefined) missingFields.push('tokenInDecimals')
    if (tokenOutDecimals === undefined) missingFields.push('tokenOutDecimals')

    if (missingFields.length > 0) {
      res.status(400).json({
        error: "Missing required fields",
        detail: `The following fields are required but missing: ${missingFields.join(', ')}`
      })
      return
    }

    if (!chainId) {
      res.status(400).json({
        error: "Missing chainId",
        detail: "chainId is required to determine the correct router address"
      })
      return
    }

    if (!from) {
      res.status(400).json({
        error: "Missing from address",
        detail: "from address is required for the transaction"
      })
      return
    }

    // Get the router address for the chain
    const V3_SWAP_ROUTER_ADDRESS = V3_SWAP_ROUTER_ADDRESSES[chainId as keyof typeof V3_SWAP_ROUTER_ADDRESSES]
    
    if (!V3_SWAP_ROUTER_ADDRESS) {
      res.status(400).json({
        error: "Unsupported chain",
        detail: `Chain ID ${chainId} is not supported`
      })
      return
    }

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
        res.status(400).json({
          error: "RPC provider not configured",
          detail: `No RPC provider found for chain ID ${chainId}`
        })
        return
      }
      provider = new ethers.providers.StaticJsonRpcProvider(url)
    }

    // Create router as per Uniswap documentation
    const router = new AlphaRouter({
      chainId: chainId as ChainId,
      provider,
    })

    // Get current gas prices from the network
    const gasPrices = await getGasPrices(provider)

    // Create token objects
    const tokenIn = new Token(tokenInChainId, tokenInAddress, tokenInDecimals) // Default to 18 decimals, should be fetched from chain
    const tokenOut = new Token(tokenOutChainId, tokenOutAddress, tokenOutDecimals) // Default to 6 decimals, should be fetched from chain

    // Create swap options as per Uniswap documentation
    const options: SwapOptionsSwapRouter02 = {
      recipient: recipient,
      slippageTolerance: new Percent(Math.round(parseFloat(slippageTolerance) * 100), 10_000),
      deadline: deadline ? Math.floor(Date.now() / 1000 + parseInt(deadline)) : Math.floor(Date.now() / 1000 + 1800),
      type: SwapType.SWAP_ROUTER_02,
    }

    // Create currency amount and trade type
    const rawTokenAmount = JSBI.BigInt(amount)
    const currencyAmount = CurrencyAmount.fromRawAmount(tokenIn, rawTokenAmount)
    const tradeType = type === 'exactIn' ? TradeType.EXACT_INPUT : TradeType.EXACT_OUTPUT

    // Get route using Uniswap SDK
    const route = await router.route(
      currencyAmount,
      tokenOut,
      tradeType,
      options
    )

    if (!route || !route.methodParameters) {
      res.status(400).json({
        error: "No route found",
        detail: "Unable to find a route for the specified swap parameters"
      })
      return
    }

    // Build the transaction data as per Uniswap documentation
    const swapData: SwapResponse = {
      data: route.methodParameters.calldata,
      to: V3_SWAP_ROUTER_ADDRESS,
      value: route.methodParameters.value,
      from: from,
      maxFeePerGas: gasPrices.maxFeePerGas,
      maxPriorityFeePerGas: gasPrices.maxPriorityFeePerGas,
    }

    res.json(swapData)

  } catch (error) {
    console.error("Error in handleSwap:", error)
    res.status(500).json({
      error: "Internal server error",
      detail: error instanceof Error ? error.message : "Unknown error occurred"
    })
  }
}