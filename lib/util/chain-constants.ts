import {
    ChainId
  } from '@uniswap/smart-order-router'

export const ID_TO_PROVIDER_URL = (id: ChainId): string => {
    switch (id) {
      case ChainId.MAINNET:
        return process.env.JSON_RPC_URL!;
      case ChainId.ROPSTEN:
        return process.env.JSON_RPC_URL_ROPSTEN!;
      case ChainId.RINKEBY:
        return process.env.JSON_RPC_URL_RINKEBY!;
      case ChainId.GÖRLI:
        return process.env.JSON_RPC_URL_GÖRLI!;
      case ChainId.KOVAN:
        return process.env.JSON_RPC_URL_KOVAN!;
      case ChainId.OPTIMISM:
        return process.env.JSON_RPC_URL_OPTIMISM!;
      case ChainId.OPTIMISTIC_KOVAN:
        return process.env.JSON_RPC_URL_OPTIMISTIC_KOVAN!;
      case ChainId.ARBITRUM_ONE:
        return process.env.JSON_RPC_URL_ARBITRUM_ONE!;
      case ChainId.ARBITRUM_RINKEBY:
        return process.env.JSON_RPC_URL_ARBITRUM_RINKEBY!;
      default:
        throw new Error(`Chain id: ${id} not supported`);
    }
}

export const ID_TO_PROVIDER_USER = (id: ChainId): string => {
    switch (id) {
      case ChainId.MAINNET:
        return process.env.JSON_RPC_USERNAME!;
      case ChainId.ROPSTEN:
        return process.env.JSON_RPC_USERNAME_ROPSTEN!;
      case ChainId.RINKEBY:
        return process.env.JSON_RPC_USERNAME_RINKEBY!;
      case ChainId.GÖRLI:
        return process.env.JSON_RPC_USERNAME_GÖRLI!;
      case ChainId.KOVAN:
        return process.env.JSON_RPC_USERNAME_KOVAN!;
      case ChainId.OPTIMISM:
        return process.env.JSON_RPC_USERNAME_OPTIMISM!;
      case ChainId.OPTIMISTIC_KOVAN:
        return process.env.JSON_RPC_USERNAME_OPTIMISTIC_KOVAN!;
      case ChainId.ARBITRUM_ONE:
        return process.env.JSON_RPC_USERNAME_ARBITRUM_ONE!;
      case ChainId.ARBITRUM_RINKEBY:
        return process.env.JSON_RPC_USERNAME_ARBITRUM_RINKEBY!;
      default:
        throw new Error(`Chain id: ${id} not supported`);
    }
}

export const ID_TO_PROVIDER_PW = (id: ChainId): string => {
    switch (id) {
      case ChainId.MAINNET:
        return process.env.JSON_RPC_USERNAME!;
      case ChainId.ROPSTEN:
        return process.env.JSON_RPC_USERNAME_ROPSTEN!;
      case ChainId.RINKEBY:
        return process.env.JSON_RPC_USERNAME_RINKEBY!;
      case ChainId.GÖRLI:
        return process.env.JSON_RPC_USERNAME_GÖRLI!;
      case ChainId.KOVAN:
        return process.env.JSON_RPC_USERNAME_KOVAN!;
      case ChainId.OPTIMISM:
        return process.env.JSON_RPC_USERNAME_OPTIMISM!;
      case ChainId.OPTIMISTIC_KOVAN:
        return process.env.JSON_RPC_USERNAME_OPTIMISTIC_KOVAN!;
      case ChainId.ARBITRUM_ONE:
        return process.env.JSON_RPC_USERNAME_ARBITRUM_ONE!;
      case ChainId.ARBITRUM_RINKEBY:
        return process.env.JSON_RPC_USERNAME_ARBITRUM_RINKEBY!;
      default:
        throw new Error(`Chain id: ${id} not supported`);
    }
}