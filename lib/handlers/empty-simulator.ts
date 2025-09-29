// Copy of  https://github.com/hemilabs/uniswap-routing-api/blob/1a9c58fbf82830b608cd59f0529134c3de52c886/lib/handlers/empty-simulator.ts
import { Simulator, SwapRoute, SwapOptions } from '@uniswap/smart-order-router'

export class EmptySimulator extends Simulator {


    protected async simulateTransaction(
        // @ts-ignore
        fromAddress: string,
        // @ts-ignore
        swapOptions: SwapOptions,
        swapRoute: SwapRoute
    ): Promise<SwapRoute> {
        return swapRoute
    }
    protected async userHasSufficientBalance(): Promise<boolean> {
        return true
    }
    protected async checkTokenApproved(): Promise<boolean> {
        return true
    }
}
