import { Request, Response } from "express"
import { GlobalRpcProviders } from '../../lib/rpc/GlobalRpcProviders'
import { ChainId } from '@juiceswapxyz/sdk-core'
import Logger from 'bunyan'

enum SwapStatus {
    PENDING = 'PENDING',
    SUCCESS = 'SUCCESS',
    NOT_FOUND = 'NOT_FOUND',
    FAILED = 'FAILED',
    EXPIRED = 'EXPIRED',
}

interface GetSwapsResponse {
    requestId: string;
    swaps: Array<{
        swapType?: string;
        status?: SwapStatus;
        txHash?: string;
        swapId?: string;
    }>;
}


export const handleSwaps = async (req: Request, res: Response) => {
    const { txHashes, chainId } = req.query
    if (!txHashes || !chainId) {
        res.status(400).json({ message: 'Missing txHashes or chainId' })
        return
    }

    const txHashesArray = txHashes.toString().split(',')
    if (txHashesArray.length === 0) {
        res.status(400).json({ message: 'Invalid txHashes' })
        return
    }

    const log = Logger.createLogger({
        name: 'handleSwaps',
        level: 'info'
    })

    try {
        const chainIdNumber = parseInt(chainId.toString())
        const providers = GlobalRpcProviders.getGlobalUniRpcProviders(log)
        const provider = providers.get(chainIdNumber as ChainId)

        if (!provider) {
            res.status(400).json({ message: `No RPC provider available for chainId ${chainId}` })
            return
        }

        const swapPromises = txHashesArray.map(async (txHash: string) => {
            try {
                const receipt = await provider.getTransactionReceipt(txHash.trim())

                if (!receipt) {
                    return {
                        txHash: txHash.trim(),
                        status: SwapStatus.NOT_FOUND
                    }
                }

                if (receipt.status === 1) {
                    return {
                        txHash: txHash.trim(),
                        status: SwapStatus.SUCCESS
                    }
                } else if (receipt.status === 0) {
                    return {
                        txHash: txHash.trim(),
                        status: SwapStatus.FAILED
                    }
                } else {
                    return {
                        txHash: txHash.trim(),
                        status: SwapStatus.PENDING
                    }
                }
            } catch (error: any) {
                log.error({ error, txHash }, `Error checking transaction status for ${txHash}`)

                return {
                    txHash: txHash.trim(),
                    status: SwapStatus.NOT_FOUND,
                }
            }
        })

        const swapResults = await Promise.all(swapPromises)

        const swaps: GetSwapsResponse = {
            requestId: Math.random().toString(36).substring(2, 15),
            swaps: swapResults.map(swap => ({
                swapType: 'CLASSIC',
                swapId: swap.txHash,
                ...swap
            }))
        }

        res.status(200).json(swaps)
    } catch (error: any) {
        log.error({ error }, 'Error in handleSwaps')
        res.status(500).json({ message: 'Internal server error' })
    }
}