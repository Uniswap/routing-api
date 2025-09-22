import { Request, Response } from "express";
import { handleClassicSwap } from "./handleClasicSwap";
import { handleWrappedSwap } from "./handleWrapSwap";


export async function handleSwap(req: Request, res: Response): Promise<void> {
    const { type } = req.body;

    try {

        if (type === 'WRAP' || type === 'UNWRAP') {
            return handleWrappedSwap(req, res);
        }
        return handleClassicSwap(req, res);
    } catch (error) {
        console.error("Error in handleSwap:", error);
        res.status(500).json({
            error: "Internal server error",
            detail: error instanceof Error ? error.message : "Unknown error occurred"
        });
    }

}