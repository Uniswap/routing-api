import { ADDRESS_ZERO } from "@juiceswapxyz/v3-sdk";
import { getGasPrices, getGlobalRpcProvider } from "../../services/globalRcpProvider";
import { Response } from "express";

interface QuoteQueryParams {
    currencyIn: string;
    currencyOut: string;
    chainId: number;
    amount: string;
    swapper?: string;
}

enum ActionType {
    WRAP = "WRAP",
    UNWRAP = "UNWRAP",
}

export async function handleWrappedQuote(quoteQuery: QuoteQueryParams, res: Response): Promise<any> {
    const provider = getGlobalRpcProvider(quoteQuery.chainId)

    if (!provider) {
        res.status(400).json({
            error: "RPC provider not configured",
            detail: `No RPC provider found for chain ID ${quoteQuery.chainId}`
        })
        return
    }

    const actionType = quoteQuery.currencyIn.toLowerCase() === ADDRESS_ZERO ? ActionType.WRAP : ActionType.UNWRAP;

    const gasPrices = await getGasPrices(provider)
    const gasFeeQuote = gasPrices.maxFeePerGas
    const gasUseEstimate = gasPrices.maxFeePerGas
    const maxFeePerGas = gasPrices.maxFeePerGas
    const maxPriorityFeePerGas = gasPrices.maxPriorityFeePerGas

    res.status(200).json({
        "requestId": Math.random().toString(36).substring(2, 15),
        "routing": actionType,
        "permitData": null,
        "quote": {
          "chainId": quoteQuery.chainId,
          "swapper": quoteQuery.swapper,
          "input": {
            "amount": quoteQuery.amount,
            "token": quoteQuery.currencyIn
          },
          "output": {
            "amount": quoteQuery.amount,
            "token": quoteQuery.currencyOut,
            "recipient": quoteQuery.swapper
          },          
          "tradeType": "EXACT_INPUT",
          "gasFee": gasFeeQuote,
          "gasFeeQuote": gasFeeQuote,
          "gasUseEstimate": gasUseEstimate,
          "maxFeePerGas": maxFeePerGas,
          "maxPriorityFeePerGas": maxPriorityFeePerGas
        }
      })

}