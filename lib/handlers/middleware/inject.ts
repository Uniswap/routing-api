import middy from '@middy/core';
import { MiddlewareObj } from '@middy/core';
import {
  DefaultRouter,
  ETHGasStationInfoGasPriceProvider,
  HeuristicGasModelFactory,
  ID_TO_CHAIN_ID,
  ID_TO_NETWORK_NAME,
  Multicall2Provider,
  PoolProvider,
  QuoteProvider,
  SubgraphProvider,
  TokenProvider,
} from '@uniswap/smart-order-router';
import { ethers, providers } from 'ethers';
import bunyan from 'bunyan';
import Logger from 'bunyan';

export type Body = {
  tokenIn: string;
  tokenOut: string;
  chainId: number;
  amount: string;
};

export type Injected = {
  router: DefaultRouter;
  tokenProvider: TokenProvider;
  log: Logger;
};

export const inject = (): MiddlewareObj => {
  return {
    before: async (request: middy.Request) => {
      const chainIdNumb = 1;
      const tokenListURI = 'https://gateway.ipfs.io/ipns/tokens.uniswap.org';

      const chainId = ID_TO_CHAIN_ID(chainIdNumb);
      const chainName = ID_TO_NETWORK_NAME(chainIdNumb);

      const logLevel = bunyan.DEBUG;
      const log: Logger = bunyan.createLogger({
        name: 'Uniswap Routing Lambda',
        serializers: bunyan.stdSerializers,
        level: logLevel,
      });
      
      const provider = new ethers.providers.InfuraProvider(
        chainName,
        process.env.INFURA_KEY
      ) as providers.BaseProvider;

      const multicall2Provider = new Multicall2Provider(provider, log);
      const tokenProvider = await TokenProvider.fromTokenListURI(
        tokenListURI,
        log
      );

      const router = new DefaultRouter({
        chainId,
        subgraphProvider: new SubgraphProvider(log),
        multicall2Provider: new Multicall2Provider(provider, log),
        poolProvider: new PoolProvider(multicall2Provider, log),
        quoteProvider: new QuoteProvider(multicall2Provider, log),
        gasPriceProvider: new ETHGasStationInfoGasPriceProvider(log),
        gasModelFactory: new HeuristicGasModelFactory(log),
        tokenProvider,
        log,
      });

      request.event.injected = { router, tokenProvider, log };
    },
  };
};
