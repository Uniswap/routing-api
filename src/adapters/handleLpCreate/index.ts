import { Request, Response } from "express"
import { LpCreateResponseBody, LpCreateRequestBody } from "./types"
import { getGlobalRpcProvider } from "../../services/globalRcpProvider"
import { NONFUNGIBLE_POSITION_MANAGER_ADDRESSES } from "@juiceswapxyz/sdk-core"
import {
  NonfungiblePositionManager,
  Position,
  nearestUsableTick,
  TickMath,
  ADDRESS_ZERO,
} from "@juiceswapxyz/v3-sdk"
import { Token, CurrencyAmount, Percent, WETH9 } from "@juiceswapxyz/sdk-core"
import JSBI from "jsbi"
import { ethers } from "ethers"
import { getPoolInstance } from "./poolFactory"

const ERC20_ABI = ["function decimals() view returns (uint8)"]
const NPM_IFACE = new ethers.utils.Interface([
  "function multicall(bytes[] data) payable returns (bytes[] results)",
  "function refundETH()",
])

const TICK_SPACING: Record<number, number> = {
  100: 1,
  500: 10,
  3000: 60,
  10000: 200,
}

const getTokenAddress = (token: string, chainId: number) => {
  const address = token === ADDRESS_ZERO ? WETH9[chainId].address : token;
  return ethers.utils.getAddress(address);
}

const isNativeCurrencyPair = (token0: string, token1: string) => {
  return token0 === ADDRESS_ZERO || token1 === ADDRESS_ZERO;
}

const calculateTxValue = (token0: string, amount0Raw: string, token1: string, amount1Raw: string) => {
  if (!isNativeCurrencyPair(token0, token1)) {
    return ethers.BigNumber.from("0");
  }

  const amount = token0 === ADDRESS_ZERO ? amount0Raw : amount1Raw;
  return ethers.BigNumber.from(amount);
}

export async function handleLpCreate(req: Request, res: Response): Promise<void> {
  try {
    const {
      walletAddress,
      chainId,
      independentAmount,
      independentToken,
      initialDependentAmount,
      initialPrice,
      position,
    }: LpCreateRequestBody = req.body

    if (
      !walletAddress ||
      !chainId ||
      !independentAmount ||
      !independentToken ||
      !position ||
      !position?.pool?.token0 ||
      !position?.pool?.token1 ||
      position?.pool?.fee === undefined ||
      position?.tickLower === undefined ||
      position?.tickUpper === undefined
    ) {
      res.status(400).json({ message: "Missing required fields", error: "MissingRequiredFields" })
      return
    }


    const isNewPool = initialPrice && initialDependentAmount
    const isExistingPool = !initialPrice && !initialDependentAmount
    if (!isNewPool && !isExistingPool) {
      res.status(400).json({ message: "Invalid input: provide either both initialPrice+initialDependentAmount or neither", error: "InvalidInput" })
      return
    }

    const provider = getGlobalRpcProvider(chainId)
    if (!provider) {
      res.status(400).json({ message: "Invalid chainId", error: "InvalidChainId" })
      return
    }

    const positionManagerAddress = NONFUNGIBLE_POSITION_MANAGER_ADDRESSES[chainId]
    if (!positionManagerAddress) {
      res.status(400).json({ message: "Unsupported chain for LP operations", error: "UnsupportedChain" })
      return
    }

    const token0Addr = getTokenAddress(position.pool.token0, chainId)
    const token1Addr = getTokenAddress(position.pool.token1, chainId)
    if (token0Addr.toLowerCase() >= token1Addr.toLowerCase()) {
      res.status(400).json({ message: "token0 must be < token1 by address", error: "TokenOrderInvalid" })
      return
    }

    const [dec0, dec1] = await Promise.all([
      new ethers.Contract(token0Addr, ERC20_ABI, provider).decimals(),
      new ethers.Contract(token1Addr, ERC20_ABI, provider).decimals(),
    ])

    const token0 = new Token(chainId, token0Addr, dec0)
    const token1 = new Token(chainId, token1Addr, dec1)

    const poolInstance = await getPoolInstance({
      token0,
      token1,
      fee: position.pool.fee,
      chainId,
      sqrtPriceX96: initialPrice,
      tickCurrent: initialPrice ? TickMath.getTickAtSqrtRatio(JSBI.BigInt(initialPrice)) : undefined,
      provider,
    })
    if (!poolInstance) {
      res.status(400).json({ message: "Invalid pool instance", error: "InvalidPoolInstance" })
      return
    }

    const spacing = TICK_SPACING[position.pool.fee] ?? position.pool.tickSpacing
    if (spacing === undefined) {
      res.status(400).json({ message: "Unsupported fee tier", error: "UnsupportedFee" })
      return
    }

    const tickLower = nearestUsableTick(position.tickLower, spacing)
    const tickUpper = nearestUsableTick(position.tickUpper, spacing)
    if (tickLower >= tickUpper) {
      res.status(400).json({ message: "Invalid tick range: tickLower < tickUpper", error: "InvalidTickRange" })
      return
    }

    const independentIsToken0 = independentToken === "TOKEN_0"

    let amount0Raw: string, amount1Raw: string

    if (isNewPool) {
      amount0Raw = independentIsToken0 ? independentAmount : initialDependentAmount!
      amount1Raw = independentIsToken0 ? initialDependentAmount! : independentAmount
    } else {

      let positionCalc: Position

      if (independentIsToken0) {
        positionCalc = Position.fromAmount0({
          pool: poolInstance,
          tickLower,
          tickUpper,
          amount0: JSBI.BigInt(independentAmount),
          useFullPrecision: false
        })

        amount0Raw = independentAmount
        amount1Raw = positionCalc.amount1.quotient.toString()
      } else {
        positionCalc = Position.fromAmount1({
          pool: poolInstance,
          tickLower,
          tickUpper,
          amount1: JSBI.BigInt(independentAmount)
        })

        amount0Raw = positionCalc.amount0.quotient.toString()
        amount1Raw = independentAmount
      }
    }

    const amount0 = CurrencyAmount.fromRawAmount(token0, amount0Raw)
    const amount1 = CurrencyAmount.fromRawAmount(token1, amount1Raw)

    if (JSBI.equal(amount0.quotient, JSBI.BigInt(0)) && JSBI.equal(amount1.quotient, JSBI.BigInt(0))) {
      res.status(400).json({ message: "Both token amounts cannot be zero", error: "InvalidAmounts" })
      return
    }

    const positionInstance = Position.fromAmounts({
      pool: poolInstance,
      tickLower,
      tickUpper,
      amount0: amount0.quotient,
      amount1: amount1.quotient,
      useFullPrecision: false,
    })

    const slippageTolerance = new Percent(50, 10_000)
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20

    const { calldata: createCD, value: createVal } =
      NonfungiblePositionManager.createCallParameters(poolInstance)
    const { calldata: mintCD, value: mintVal } =
      NonfungiblePositionManager.addCallParameters(positionInstance, {
        recipient: walletAddress,
        deadline,
        slippageTolerance,
      })

    const calls: string[] = [createCD, mintCD];

    if (isNativeCurrencyPair(position.pool.token0, position.pool.token1)) {
      calls.push(NPM_IFACE.encodeFunctionData("refundETH", []));
    }

    const multicallData = NPM_IFACE.encodeFunctionData("multicall", [calls])
    const nativeValue = calculateTxValue(position.pool.token0, amount0Raw, position.pool.token1, amount1Raw)
    const totalValueBN = ethers.BigNumber.from(createVal || "0").add(ethers.BigNumber.from(mintVal || "0")).add(nativeValue)
    const totalValueHex = totalValueBN.toHexString()
    const feeData = await provider.getFeeData()

    let gasEstimate = ethers.BigNumber.from("300000")
    try {
      gasEstimate = await provider.estimateGas({
        to: positionManagerAddress,
        from: walletAddress,
        data: multicallData,
        value: totalValueHex,
      })
    } catch (e) {
      console.warn("Gas estimation failed, using fallback")
    }

    const gasLimit = gasEstimate.mul(110).div(100)
    
    const baseFee = feeData.lastBaseFeePerGas || ethers.utils.parseUnits("0.00000136", "gwei")
    const maxPriorityFeePerGas = ethers.utils.parseUnits("1", "gwei")
    const maxFeePerGas = baseFee.mul(105).div(100).add(maxPriorityFeePerGas)

    const gasFee = gasLimit.mul(maxFeePerGas)

    const response: LpCreateResponseBody = {
      requestId: `lp-create-${Date.now()}`,
      create: {
        to: positionManagerAddress,
        from: walletAddress,
        data: multicallData,
        value: totalValueHex,
        maxFeePerGas: maxFeePerGas.toString(),
        maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
        gasLimit: gasLimit.toString(),
        chainId,
      },
      dependentAmount: independentIsToken0 ? amount1.quotient.toString() : amount0.quotient.toString(),
      gasFee: ethers.utils.formatEther(gasFee),
    }

    res.status(200).json(response)
  } catch (error: any) {
    res.status(500).json({ message: "Internal server error", error: error?.message })
  }
}
