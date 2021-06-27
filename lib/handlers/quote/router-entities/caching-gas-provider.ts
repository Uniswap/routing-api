import {
  ETHGasStationInfoProvider,
  GasPrice,
  log,
} from '@uniswap/smart-order-router';
import NodeCache from 'node-cache';

const GAS_CACHE = new NodeCache({ stdTTL: 180, useClones: true });
const GAS_KEY = 'gas';

export class CachingGasStationProvider extends ETHGasStationInfoProvider {
  public async getGasPrice(): Promise<GasPrice> {
    const cachedGasPrice = GAS_CACHE.get<GasPrice>(GAS_KEY);

    if (cachedGasPrice) {
      log.info(
        { cachedGasPrice },
        `Got gas station price from local cache: ${cachedGasPrice.gasPriceWei}.`
      );

      return cachedGasPrice;
    }

    log.info('Gas station price local cache miss.');
    const gasPrice = await super.getGasPrice();
    GAS_CACHE.set<GasPrice>(GAS_KEY, gasPrice);

    return gasPrice;
  }
}
