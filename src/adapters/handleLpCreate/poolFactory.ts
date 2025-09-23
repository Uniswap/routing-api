import { computePoolAddress, Pool } from "@juiceswapxyz/v3-sdk"
import { CHAIN_TO_ADDRESSES_MAP, Token } from "@juiceswapxyz/sdk-core"
import { ethers } from "ethers"

const getPoolInstanceFromOnchainData = async (token0: Token, token1: Token, fee: number, chainId: number, provider: any) => {
    try {
        // Calculate pool address
        const chainAddresses = CHAIN_TO_ADDRESSES_MAP[chainId as keyof typeof CHAIN_TO_ADDRESSES_MAP]
        const poolAddress = computePoolAddress({
            factoryAddress: chainAddresses.v3CoreFactoryAddress,
            tokenA: token0,
            tokenB: token1,
            fee: fee
        })

        const poolContract = new ethers.Contract(poolAddress, [
            "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)"
        ], provider)

        const slot0 = await poolContract.slot0()
        const currentSqrtPriceX96 = slot0.sqrtPriceX96
        const currentTick = slot0.tick

        return new Pool(
            token0,
            token1,
            fee,
            currentSqrtPriceX96.toString(),
            "0",
            currentTick
        )
    } catch (e) {
        return null
    }
}

export type getPoolInstanceParams = {
    token0: Token,
    token1: Token,
    fee: number,
    provider: any,
    chainId: number,
    sqrtPriceX96?: string,
    liquidity?: string,
    tickCurrent?: number,
}

export const getPoolInstance = ({ token0, token1, fee, chainId, sqrtPriceX96, liquidity = "0", tickCurrent, provider }: getPoolInstanceParams) => {
    if (token0 && token1 && fee && sqrtPriceX96 && liquidity && tickCurrent) {
        return new Pool(
            token0,
            token1,
            fee,
            sqrtPriceX96,
            liquidity,
            tickCurrent
        )
    }


    return getPoolInstanceFromOnchainData(token0, token1, fee, chainId, provider)
}