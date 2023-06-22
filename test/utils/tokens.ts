import DEFAULT_TOKEN_LIST from '@uniswap/default-token-list'
import { Token } from '@uniswap/sdk-core'
import {
  CachingTokenListProvider,
  ChainId,
  DAI_ARBITRUM,
  DAI_BSC,
  DAI_GÖRLI,
  DAI_MAINNET,
  DAI_OPTIMISM,
  DAI_OPTIMISM_GOERLI,
  DAI_POLYGON,
  DAI_POLYGON_MUMBAI,
  DAI_SEPOLIA,
  log,
  NodeJSCache,
  USDC_ARBITRUM,
  USDC_BSC,
  USDC_GÖRLI,
  USDC_MAINNET,
  USDC_OPTIMISM,
  USDC_OPTIMISM_GOERLI,
  USDC_POLYGON,
  USDC_POLYGON_MUMBAI,
  USDC_SEPOLIA,
  USDT_ARBITRUM,
  USDT_BSC,
  USDT_GÖRLI,
  USDT_MAINNET,
  USDT_OPTIMISM,
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

export const UNI_GORLI = new Token(ChainId.GÖRLI, '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', 18, 'UNI', 'Uni token')

export const DAI_ON = (chainId: ChainId): Token => {
  switch (chainId) {
    case ChainId.MAINNET:
      return DAI_MAINNET
    case ChainId.GÖRLI:
      return DAI_GÖRLI
    case ChainId.SEPOLIA:
      return DAI_SEPOLIA
    case ChainId.OPTIMISM:
      return DAI_OPTIMISM
    case ChainId.OPTIMISM_GOERLI:
      return DAI_OPTIMISM_GOERLI
    case ChainId.ARBITRUM_ONE:
      return DAI_ARBITRUM
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
    case ChainId.GÖRLI:
      return USDT_GÖRLI
    case ChainId.OPTIMISM:
      return USDT_OPTIMISM
    case ChainId.ARBITRUM_ONE:
      return USDT_ARBITRUM
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
    case ChainId.GÖRLI:
      return USDC_GÖRLI
    case ChainId.SEPOLIA:
      return USDC_SEPOLIA
    case ChainId.OPTIMISM:
      return USDC_OPTIMISM
    case ChainId.OPTIMISM_GOERLI:
      return USDC_OPTIMISM_GOERLI
    case ChainId.ARBITRUM_ONE:
      return USDC_ARBITRUM
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
