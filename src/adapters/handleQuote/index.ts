import { Request, Response } from "express";
import { handleQuoteRequest } from "../../../lib/handlers";
import { QuoteRequestBody } from "./types";
import { handleWrappedQuote } from "./wrapppedQuote";
import { getTokenAddress } from "../../utils/erc20";
import { quoteCache } from "../../services/quoteCache";

export async function handleQuote(req: Request, res: Response): Promise<void> {
    const quoteParams: QuoteRequestBody = req.body;
    const currencyIn = quoteParams.tokenIn || quoteParams.tokenInAddress;
    const currencyOut = quoteParams.tokenOut || quoteParams.tokenOutAddress;
    const tokenInChainId = quoteParams.tokenInChainId;
    const tokenInAddress = getTokenAddress(currencyIn!, tokenInChainId);
    const tokenOutChainId = quoteParams.tokenOutChainId;
    const tokenOutAddress = getTokenAddress(currencyOut!, tokenOutChainId);

    // Check cache first (before any processing)
    const cachedQuote = quoteCache.get(quoteParams);
    if (cachedQuote) {
        // Add cache header for monitoring
        res.setHeader('X-Quote-Cache', 'HIT');
        res.setHeader('X-Cache-Stats', JSON.stringify(quoteCache.getStats()));
        res.json(cachedQuote);
        return;
    }

    // Cache miss - add header
    res.setHeader('X-Quote-Cache', 'MISS');

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

    // Store original send function to intercept response
    const originalSend = res.json.bind(res);
    res.json = function(data: any) {
        // Cache successful responses
        if (quoteCache.shouldCache(quoteParams, data)) {
            quoteCache.set(quoteParams, data);
        }
        return originalSend(data);
    };

    // Handle normal quote request
    return handleQuoteRequest(req, res);
}