import { ADDRESS_ZERO } from "@juiceswapxyz/v3-sdk";
import { WETH9 } from "@juiceswapxyz/sdk-core";

export const getTokenAddress = (token: string, chainId: number) => {
    return token === ADDRESS_ZERO ? WETH9[chainId].address : token;
}