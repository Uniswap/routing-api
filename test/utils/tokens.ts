import { Token } from '@uniswap/sdk-core'
import { CachingTokenListProvider, NodeJSCache, ChainId } from '@uniswap/smart-order-router'
import NodeCache from 'node-cache'
import { ethers } from 'ethers'
import DEFAULT_TOKEN_LIST from '@uniswap/default-token-list'

export const getTokenListProvider = (id: ChainId) => {
  return new CachingTokenListProvider(id, DEFAULT_TOKEN_LIST, new NodeJSCache(new NodeCache()))
}

export const getAmount = async (id: ChainId, type: string, symbolIn: string, symbolOut: string, amount: string) => {
  const tokenListProvider = getTokenListProvider(id)
  const decimals = (await tokenListProvider.getTokenBySymbol(type == 'exactIn' ? symbolIn : symbolOut))!.decimals
  return ethers.utils.parseUnits(amount, decimals).toString()
}

export const USDC_MAINNET = new Token(
  ChainId.MAINNET,
  '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  6,
  'USDC',
  'USD//C'
)
export const USDT_MAINNET = new Token(
  ChainId.MAINNET,
  '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  6,
  'USDT',
  'Tether USD'
)
export const WBTC_MAINNET = new Token(
  ChainId.MAINNET,
  '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
  8,
  'WBTC',
  'Wrapped BTC'
)
export const UNI_MAINNET = new Token(
  ChainId.MAINNET,
  '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
  18,
  'UNI',
  'Uniswap'
)
export const DAI_MAINNET = new Token(
  ChainId.MAINNET,
  '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  18,
  'DAI',
  'Dai Stablecoin'
)
