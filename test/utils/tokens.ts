import DEFAULT_TOKEN_LIST from '@uniswap/default-token-list'
import { Token, WETH9 } from '@uniswap/sdk-core'
import { CachingTokenListProvider, ChainId, NodeJSCache } from '@uniswap/smart-order-router'
import { ethers } from 'ethers'
import NodeCache from 'node-cache'

export const getTokenListProvider = (id: ChainId) => {
  return new CachingTokenListProvider(id, DEFAULT_TOKEN_LIST, new NodeJSCache(new NodeCache()))
}

export const getAmount = async (id: ChainId, type: string, symbolIn: string, symbolOut: string, amount: string) => {
  const tokenListProvider = getTokenListProvider(id)
  const decimals = (await tokenListProvider.getTokenBySymbol(type == 'exactIn' ? symbolIn : symbolOut))!.decimals
  return ethers.utils.parseUnits(amount, decimals).toString()
}

export const getAmountFromToken = async (type: string, tokenIn: Token, tokenOut: Token, amount: string) => {
  const decimals = (type == 'exactIn' ? tokenIn : tokenOut).decimals
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
export const USDC_ROPSTEN = new Token(
  ChainId.ROPSTEN,
  '0x07865c6e87b9f70255377e024ace6630c1eaa37f',
  6,
  'USDC',
  'USD//C'
)
export const USDT_ROPSTEN = new Token(
  ChainId.ROPSTEN,
  '0x516de3a7a567d81737e3a46ec4ff9cfd1fcb0136',
  6,
  'USDT',
  'Tether USD'
)
export const DAI_ROPSTEN = new Token(
  ChainId.ROPSTEN,
  '0xad6d458402f60fd3bd25163575031acdce07538d',
  18,
  'DAI',
  'Dai Stablecoin'
)

export const DAI_RINKEBY_1 = new Token(ChainId.RINKEBY, '0x5592ec0cfb4dbc12d3ab100b257153436a1f0fea', 18, 'DAI', 'DAI')
export const DAI_RINKEBY_2 = new Token(ChainId.RINKEBY, '0xc7AD46e0b8a400Bb3C915120d284AafbA8fc4735', 18, 'DAI', 'DAI')
export const USDC_RINKEBY = new Token(
  ChainId.RINKEBY,
  '0x4DBCdF9B62e891a7cec5A2568C3F4FAF9E8Abe2b',
  6,
  'tUSDC',
  'test USD//C'
)
export const USDT_RINKEBY = new Token(
  ChainId.RINKEBY,
  '0xa689352b7c1cad82864beb1d90679356d3962f4d',
  18,
  'USDT',
  'Tether USD'
)

export const USDC_GÖRLI = new Token(ChainId.GÖRLI, '0x07865c6e87b9f70255377e024ace6630c1eaa37f', 6, 'USDC', 'USD//C')
export const USDT_GÖRLI = new Token(
  ChainId.GÖRLI,
  '0xe583769738b6dd4e7caf8451050d1948be717679',
  18,
  'USDT',
  'Tether USD'
)
export const WBTC_GÖRLI = new Token(
  ChainId.GÖRLI,
  '0xa0a5ad2296b38bd3e3eb59aaeaf1589e8d9a29a9',
  8,
  'WBTC',
  'Wrapped BTC'
)
export const DAI_GÖRLI = new Token(
  ChainId.GÖRLI,
  '0x11fe4b6ae13d2a6055c8d9cf65c55bac32b5d844',
  18,
  'DAI',
  'Dai Stablecoin'
)

export const USDC_KOVAN = new Token(ChainId.KOVAN, '0x31eeb2d0f9b6fd8642914ab10f4dd473677d80df', 6, 'USDC', 'USD//C')
export const USDT_KOVAN = new Token(
  ChainId.KOVAN,
  '0xa325f1b1ebb748715dfbbaf62e0c6677e137f45d',
  18,
  'USDT',
  'Tether USD'
)
export const WBTC_KOVAN = new Token(
  ChainId.KOVAN,
  '0xe36bc5d8b689ad6d80e78c3e736670e80d4b329d',
  8,
  'WBTC',
  'Wrapped BTC'
)
export const DAI_KOVAN = new Token(
  ChainId.KOVAN,
  '0x9dc7b33c3b63fc00ed5472fbd7813edda6a64752',
  18,
  'DAI',
  'Dai Stablecoin'
)

export const USDC_OPTIMISM = new Token(
  ChainId.OPTIMISM,
  '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
  6,
  'USDC',
  'USD//C'
)
export const USDT_OPTIMISM = new Token(
  ChainId.OPTIMISM,
  '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
  6,
  'USDT',
  'Tether USD'
)
export const WBTC_OPTIMISM = new Token(
  ChainId.OPTIMISM,
  '0x68f180fcCe6836688e9084f035309E29Bf0A2095',
  8,
  'WBTC',
  'Wrapped BTC'
)
export const DAI_OPTIMISM = new Token(
  ChainId.OPTIMISM,
  '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
  18,
  'DAI',
  'Dai Stablecoin'
)

export const USDC_OPTIMISTIC_KOVAN = new Token(
  ChainId.OPTIMISTIC_KOVAN,
  '0x4e62882864fB8CE54AFfcAf8D899A286762B011B',
  6,
  'USDC',
  'USD//C'
)
export const USDT_OPTIMISTIC_KOVAN = new Token(
  ChainId.OPTIMISTIC_KOVAN,
  '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
  6,
  'USDT',
  'Tether USD'
)
export const WBTC_OPTIMISTIC_KOVAN = new Token(
  ChainId.OPTIMISTIC_KOVAN,
  '0x2382a8f65b9120E554d1836a504808aC864E169d',
  8,
  'WBTC',
  'Wrapped BTC'
)
export const DAI_OPTIMISTIC_KOVAN = new Token(
  ChainId.OPTIMISTIC_KOVAN,
  '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
  18,
  'DAI',
  'Dai Stablecoin'
)

export const USDC_ARBITRUM = new Token(
  ChainId.ARBITRUM_ONE,
  '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
  6,
  'USDC',
  'USD//C'
)
export const USDT_ARBITRUM = new Token(
  ChainId.ARBITRUM_ONE,
  '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
  6,
  'USDT',
  'Tether USD'
)
export const WBTC_ARBITRUM = new Token(
  ChainId.ARBITRUM_ONE,
  '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
  8,
  'WBTC',
  'Wrapped BTC'
)
export const DAI_ARBITRUM = new Token(
  ChainId.ARBITRUM_ONE,
  '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
  18,
  'DAI',
  'Dai Stablecoin'
)

export const DAI_ARBITRUM_RINKEBY = new Token(
  ChainId.ARBITRUM_RINKEBY,
  '0x2f3C1B6A51A469051A22986aA0dDF98466cc8D3c',
  18,
  'DAI',
  'Dai Stablecoin'
)

export const USDT_ARBITRUM_RINKEBY = new Token(
  ChainId.ARBITRUM_RINKEBY,
  '0x920b9301c2de92186299cd2abc7199e25b9728b3',
  6,
  'UDST',
  'Tether USD'
)

export const USDC_ARBITRUM_RINKEBY = new Token(
  ChainId.ARBITRUM_RINKEBY,
  '0xB17736aA76003F4873D9f4366190E5c6678d9a52',
  6,
  'USDC',
  'USD//C'
)

export const UNI_ARBITRUM_RINKEBY = new Token(
  ChainId.ARBITRUM_RINKEBY,
  '0x049251a7175071316e089d0616d8b6aacd2c93b8',
  18,
  'UNI',
  'Uni token'
)

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
    case ChainId.OPTIMISTIC_KOVAN:
      return DAI_OPTIMISTIC_KOVAN
    case ChainId.ARBITRUM_ONE:
      return DAI_ARBITRUM
    case ChainId.ARBITRUM_RINKEBY:
      return DAI_ARBITRUM_RINKEBY
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
    case ChainId.OPTIMISTIC_KOVAN:
      return USDC_OPTIMISTIC_KOVAN
    case ChainId.ARBITRUM_ONE:
      return USDC_ARBITRUM
    case ChainId.ARBITRUM_RINKEBY:
      return USDC_ARBITRUM_RINKEBY
    default:
      throw new Error(`Chain id: ${chainId} not supported`)
  }
}

export const WETH_ON = (chainId: ChainId): Token => {
  return WETH9[chainId]
}