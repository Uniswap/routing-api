import { GasPrice, IGasPriceProvider } from "@uniswap/smart-order-router";
import { BigNumber } from "ethers";

export class StaticGasPriceProvider implements IGasPriceProvider {
  constructor(private gasPriceWei: BigNumber, private blockNumber: number) {}
  async getGasPrice(): Promise<GasPrice> {
    return { gasPriceWei: this.gasPriceWei, blockNumber: this.blockNumber };
  }
}