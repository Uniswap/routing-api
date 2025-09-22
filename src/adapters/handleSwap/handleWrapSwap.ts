import { Request, Response } from "express";
import { ethers } from "ethers";
import { getGasPrices, getGlobalRpcProvider } from "../../services/globalRcpProvider";

const NATIVE_CURRENCY_ADDRESS = "0x0000000000000000000000000000000000000000";

interface WrapRequest {
    tokenInAddress: string;
    tokenInDecimals: number;
    tokenInChainId: number;
    tokenOutAddress: string;
    tokenOutDecimals: number;
    tokenOutChainId: number;
    amount: string;
    type: string;
    recipient: string;
    from: string;
    slippageTolerance: string;
    deadline: string;
    chainId: number;
}

export async function handleWrappedSwap(req: Request, res: Response): Promise<void> {
    try {
        const { 
            tokenInAddress,
            tokenInDecimals,
            tokenOutAddress,
            tokenOutDecimals,
            amount,
            type,
            recipient,
            from,
            chainId
        }: WrapRequest = req.body;

        // Validate required fields
        const missingFields = [];
        if (!tokenInAddress) missingFields.push('tokenInAddress');
        if (!tokenOutAddress) missingFields.push('tokenOutAddress');
        if (!amount) missingFields.push('amount');
        if (!type) missingFields.push('type');
        if (!recipient) missingFields.push('recipient');
        if (!from) missingFields.push('from');
        if (!chainId) missingFields.push('chainId');
        if (tokenInDecimals === undefined) missingFields.push('tokenInDecimals');
        if (tokenOutDecimals === undefined) missingFields.push('tokenOutDecimals');

        if (missingFields.length > 0) {
            res.status(400).json({
                error: "Missing required fields",
                detail: `The following fields are required but missing: ${missingFields.join(', ')}`
            });
            return;
        }

        // Validate that this is a wrap/unwrap operation
        if (type !== 'WRAP' && type !== 'UNWRAP') {
            res.status(400).json({
                error: "Invalid operation type",
                detail: "Type must be 'WRAP' or 'UNWRAP'"
            });
            return;
        }

        // Determine the wrapped token address (the one that's not native currency)
        let wrappedTokenAddress: string;
        if (tokenInAddress.toLowerCase() === NATIVE_CURRENCY_ADDRESS.toLowerCase()) {
            wrappedTokenAddress = tokenOutAddress;
        } else if (tokenOutAddress.toLowerCase() === NATIVE_CURRENCY_ADDRESS.toLowerCase()) {
            wrappedTokenAddress = tokenInAddress;
        } else {
            res.status(400).json({
                error: "Invalid wrap/unwrap request",
                detail: "One of the tokens must be native currency (0x0000000000000000000000000000000000000000)"
            });
            return;
        }

        // Get provider
        const provider = getGlobalRpcProvider(chainId);
        if (!provider) {
            res.status(400).json({
                error: "RPC provider not configured",
                detail: `No RPC provider found for chain ID ${chainId}`
            });
            return;
        }

        // Get gas prices
        const gasPrices = await getGasPrices(provider);

        // Determine if this is a wrap or unwrap operation based on the type field
        const isWrap = type === 'WRAP';
        const isUnwrap = type === 'UNWRAP';

        // Additional validation: check token addresses match wrap/unwrap pattern
        if (isWrap) {
            const isValidWrap = tokenInAddress.toLowerCase() === NATIVE_CURRENCY_ADDRESS.toLowerCase() && 
                               tokenOutAddress.toLowerCase() === wrappedTokenAddress.toLowerCase();
            if (!isValidWrap) {
                res.status(400).json({
                    error: "Invalid WRAP request",
                    detail: "For WRAP, tokenIn must be native currency and tokenOut must be the wrapped token"
                });
                return;
            }
        } else if (isUnwrap) {
            const isValidUnwrap = tokenInAddress.toLowerCase() === wrappedTokenAddress.toLowerCase() && 
                                 tokenOutAddress.toLowerCase() === NATIVE_CURRENCY_ADDRESS.toLowerCase();
            if (!isValidUnwrap) {
                res.status(400).json({
                    error: "Invalid UNWRAP request",
                    detail: "For UNWRAP, tokenIn must be the wrapped token and tokenOut must be native currency"
                });
                return;
            }
        }

        // Create WETH contract interface
        const wethInterface = new ethers.utils.Interface([
            "function deposit() payable",
            "function withdraw(uint256 amount)"
        ]);

        let transactionData: string;
        let value: string;
        const amountBN = ethers.BigNumber.from(amount);

        if (isWrap) {
            // WRAP: Call deposit() function with ETH value
            transactionData = wethInterface.encodeFunctionData("deposit", []);
            value = amountBN.toHexString();
        } else {
            // UNWRAP: Call withdraw(amount) function with no ETH value
            transactionData = wethInterface.encodeFunctionData("withdraw", [amountBN]);
            value = "0x0";
        }

        // Estimate gas limit
        const gasLimit = 46000; // Standard gas limit for WETH operations
        const gasFee = ethers.BigNumber.from(gasPrices.maxFeePerGas).mul(gasLimit);

        const response = {
            requestId: Math.random().toString(36).substring(2, 15),
            swap: {
                to: wrappedTokenAddress,
                from: from,
                value: value,
                data: transactionData,
                maxFeePerGas: gasPrices.maxFeePerGas.replace('0x', ''),
                maxPriorityFeePerGas: gasPrices.maxPriorityFeePerGas.replace('0x', ''),
                gasLimit: gasLimit.toString(),
                chainId: chainId
            },
            gasFee: gasFee.toString(),
            gasEstimates: [
                {
                    type: "eip1559",
                    strategy: {
                        limitInflationFactor: 1.15,
                        priceInflationFactor: 1.5,
                        percentileThresholdFor1559Fee: 75,
                        thresholdToInflateLastBlockBaseFee: 0.75,
                        baseFeeMultiplier: 1,
                        baseFeeHistoryWindow: 20,
                        minPriorityFeeRatioOfBaseFee: 0.2,
                        minPriorityFeeGwei: 2,
                        maxPriorityFeeGwei: 9
                    },
                    gasLimit: gasLimit.toString(),
                    gasFee: gasFee.toString(),
                    maxFeePerGas: gasPrices.maxFeePerGas.replace('0x', ''),
                    maxPriorityFeePerGas: gasPrices.maxPriorityFeePerGas.replace('0x', '')
                }
            ]
        };

        res.json(response);

    } catch (error) {
        console.error("Error in handleWrappedSwap:", error);
        res.status(500).json({
            error: "Internal server error",
            detail: error instanceof Error ? error.message : "Unknown error occurred"
        });
    }
}