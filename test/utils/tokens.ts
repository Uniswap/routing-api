import DEFAULT_TOKEN_LIST from '@uniswap/default-token-list'
import { Token } from '@uniswap/sdk-core'
import {
  CachingTokenListProvider,
  ChainId,
  DAI_ARBITRUM,
  DAI_ARBITRUM_RINKEBY,
  DAI_BSC,
  DAI_GÖRLI,
  DAI_KOVAN,
  DAI_MAINNET,
  DAI_OPTIMISM,
  DAI_OPTIMISM_GOERLI,
  DAI_OPTIMISTIC_KOVAN,
  DAI_POLYGON,
  DAI_POLYGON_MUMBAI,
  DAI_RINKEBY_1,
  DAI_ROPSTEN,
  log,
  NodeJSCache,
  USDC_ARBITRUM,
  USDC_ARBITRUM_RINKEBY,
  USDC_BSC,
  USDC_GÖRLI,
  USDC_KOVAN,
  USDC_MAINNET,
  USDC_OPTIMISM,
  USDC_OPTIMISM_GOERLI,
  USDC_OPTIMISTIC_KOVAN,
  USDC_POLYGON,
  USDC_POLYGON_MUMBAI,
  USDC_RINKEBY,
  USDC_ROPSTEN,
  USDT_ARBITRUM,
  USDT_ARBITRUM_RINKEBY,
  USDT_BSC,
  USDT_GÖRLI,
  USDT_KOVAN,
  USDT_MAINNET,
  USDT_OPTIMISM,
  USDT_OPTIMISTIC_KOVAN,
  USDT_RINKEBY,
  USDT_ROPSTEN,
  WRAPPED_NATIVE_CURRENCY,
} from '@uniswap/smart-order-router'
import { ethers } from 'ethers'
import NodeCache from 'node-cache'

export const getTokenListProvider = (id: ChainId) => {
  return new CachingTokenListProvider(id, DEFAULT_TOKEN_LIST, new NodeJSCache(new NodeCache()))
}

export const getAmount = async (id: ChainId, type: string, symbolIn: string, symbolOut: string, amount: string) => {
  const tokenListProvider = getTokenListProvider(id)
  const decimals = (await tokenListProvider.getTokenBySymbol(type == 'exactIn' ? symbolIn : symbolOut))!.decimals
  log.info(decimals)
  return ethers.utils.parseUnits(amount, decimals).toString()
}

export const getAmountFromToken = async (type: string, tokenIn: Token, tokenOut: Token, amount: string) => {
  const decimals = (type == 'exactIn' ? tokenIn : tokenOut).decimals
  return ethers.utils.parseUnits(amount, decimals).toString()
}

export const UNI_MAINNET = new Token(
  ChainId.MAINNET,
  '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
  18,
  'UNI',
  'Uniswap'
)

export const UNI_ARBITRUM_RINKEBY = new Token(
  ChainId.ARBITRUM_RINKEBY,
  '0x049251a7175071316e089d0616d8b6aacd2c93b8',
  18,
  'UNI',
  'Uni token'
)

export const UNI_GORLI = new Token(ChainId.GÖRLI, '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', 18, 'UNI', 'Uni token')

export const DAI_ON = (chainId: ChainId): Token => {
  switch (chainId) {
    case ChainId.MAINNET:
      return DAI_MAINNET
    case ChainId.ROPSTEN:
      return DAI_ROPSTEN
    case ChainId.RINKEBY:
      return DAI_RINKEBY_1
    case ChainId.GÖRLI:
      return DAI_GÖRLI
    case ChainId.KOVAN:
      return DAI_KOVAN
    case ChainId.OPTIMISM:
      return DAI_OPTIMISM
    case ChainId.OPTIMISM_GOERLI:
      return DAI_OPTIMISM_GOERLI
    case ChainId.OPTIMISTIC_KOVAN:
      return DAI_OPTIMISTIC_KOVAN
    case ChainId.ARBITRUM_ONE:
      return DAI_ARBITRUM
    case ChainId.ARBITRUM_RINKEBY:
      return DAI_ARBITRUM_RINKEBY
    case ChainId.POLYGON:
      return DAI_POLYGON
    case ChainId.POLYGON_MUMBAI:
      return DAI_POLYGON_MUMBAI
    case ChainId.BSC:
      return DAI_BSC
    default:
      throw new Error(`Chain id: ${chainId} not supported`)
  }
}

export const USDT_ON = (chainId: ChainId): Token => {
  switch (chainId) {
    case ChainId.MAINNET:
      return USDT_MAINNET
    case ChainId.ROPSTEN:
      return USDT_ROPSTEN
    case ChainId.RINKEBY:
      return USDT_RINKEBY
    case ChainId.GÖRLI:
      return USDT_GÖRLI
    case ChainId.KOVAN:
      return USDT_KOVAN
    case ChainId.OPTIMISM:
      return USDT_OPTIMISM
    case ChainId.OPTIMISTIC_KOVAN:
      return USDT_OPTIMISTIC_KOVAN
    case ChainId.ARBITRUM_ONE:
      return USDT_ARBITRUM
    case ChainId.ARBITRUM_RINKEBY:
      return USDT_ARBITRUM_RINKEBY
    case ChainId.BSC:
      return USDT_BSC
    default:
      throw new Error(`Chain id: ${chainId} not supported`)
  }
}

export const USDC_ON = (chainId: ChainId): Token => {
  switch (chainId) {
    case ChainId.MAINNET:
      return USDC_MAINNET
    case ChainId.ROPSTEN:
      return USDC_ROPSTEN
    case ChainId.RINKEBY:
      return USDC_RINKEBY
    case ChainId.GÖRLI:
      return USDC_GÖRLI
    case ChainId.KOVAN:
      return USDC_KOVAN
    case ChainId.OPTIMISM:
      return USDC_OPTIMISM
    case ChainId.OPTIMISM_GOERLI:
      return USDC_OPTIMISM_GOERLI
    case ChainId.OPTIMISTIC_KOVAN:
      return USDC_OPTIMISTIC_KOVAN
    case ChainId.ARBITRUM_ONE:
      return USDC_ARBITRUM
    case ChainId.ARBITRUM_RINKEBY:
      return USDC_ARBITRUM_RINKEBY
    case ChainId.POLYGON:
      return USDC_POLYGON
    case ChainId.POLYGON_MUMBAI:
      return USDC_POLYGON_MUMBAI
    case ChainId.BSC:
      return USDC_BSC
    default:
      throw new Error(`Chain id: ${chainId} not supported`)
  }
}

export const WNATIVE_ON = (chainId: ChainId): Token => {
  return WRAPPED_NATIVE_CURRENCY[chainId]
}
