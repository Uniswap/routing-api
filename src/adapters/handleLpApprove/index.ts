import { Request, Response } from "express"
import { getGlobalRpcProvider } from "../../services/globalRcpProvider";
import { LpApproveRequestBody } from "./types";
import { getApproveTxForToken } from "../../utils/erc20";
import { NONFUNGIBLE_POSITION_MANAGER_ADDRESSES } from "@juiceswapxyz/sdk-core";


export async function handleLpApprove(req: Request, res: Response): Promise<void> {
  try {
    const { walletAddress, chainId, token0, token1, amount0, amount1 }: LpApproveRequestBody = req.body;

    if (!walletAddress || !chainId || !token0 || !token1 || !amount0 || !amount1) {
      res.status(400).json({
        message: "Missing required fields",
        error: "MissingRequiredFields"
      })
      return
    }

    const provider = getGlobalRpcProvider(chainId)
    if (!provider) {
      res.status(400).json({
        message: "Invalid chainId",
        error: "InvalidChainId"
      })
      return
    }

    //const gasPrices = await getGasPrices(provider)

    const spender = NONFUNGIBLE_POSITION_MANAGER_ADDRESSES[chainId]
    if (!spender) {
      res.status(400).json({
        message: "Unsupported chain for LP operations",
        error: "UnsupportedChain"
      })
      return
    }

    const [token0Approval, token1Approval] = await Promise.all([
      getApproveTxForToken(token0, amount0, walletAddress, spender, provider, chainId),
      getApproveTxForToken(token1, amount1, walletAddress, spender, provider, chainId)
    ])

    res.status(200).json({
      requestId: `lp-approve-${Date.now()}`,
      token0Approval,
      token1Approval,
      token0Cancel: null,
      token1Cancel: null,
      positionTokenApproval: null,
      permitData: null,
      token0PermitTransaction: null,
      token1PermitTransaction: null,
      positionTokenPermitTransaction: null,
      gasFeeToken0Approval: token0Approval?.gasLimit || "0"
    })

  } catch (error: any) {
    res.status(500).json({
      message: "Internal server error",
      error: error?.message
    })
  }
}
