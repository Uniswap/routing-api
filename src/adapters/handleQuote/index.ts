import { Request, Response } from "express";
import { handleQuoteRequest } from "../../../lib/handlers";
import { QuoteRequestBody } from "./types";
import { handleWrappedQuote } from "./wrapppedQuote";
import { getTokenAddress } from "../../utils/getTokenAddress";

export async function handleQuote(req: Request, res: Response): Promise<void> {
    const quoteParams: QuoteRequestBody = req.body;
    const currencyIn = quoteParams.tokenIn || quoteParams.tokenInAddress;
    const currencyOut = quoteParams.tokenOut || quoteParams.tokenOutAddress;
    const tokenInChainId = quoteParams.tokenInChainId;
    const tokenInAddress = getTokenAddress(currencyIn!, tokenInChainId);
    const tokenOutChainId = quoteParams.tokenOutChainId;
    const tokenOutAddress = getTokenAddress(currencyOut!, tokenOutChainId);
    
    
    // Handle wrapping/unwrapping of the currency
    if (tokenInAddress.toLowerCase() === tokenOutAddress.toLowerCase() && currencyIn!.toLowerCase() !== currencyOut!.toLowerCase()) {
        const quoteQuery= {
            currencyIn,
            currencyOut,
            chainId: tokenInChainId,
            amount: quoteParams.amount,
            swapper: quoteParams.swapper,
        }
        
        return handleWrappedQuote(quoteQuery, res);
    }

    // Handle normal quote request
    return handleQuoteRequest(req, res);
}