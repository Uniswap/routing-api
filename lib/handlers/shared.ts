import { Currency, Ether } from '@uniswap/sdk-core'
import { AlphaRouterConfig, ChainId, ITokenListProvider, ITokenProvider } from '@uniswap/smart-order-router'
import Logger from 'bunyan'

export const DEFAULT_ROUTING_CONFIG: AlphaRouterConfig = {
  v2PoolSelection: {
    topN: 3,
    topNDirectSwaps: 1,
    topNTokenInOut: 5,
    topNSecondHop: 3,
    topNWithEachBaseToken: 4,
    topNWithBaseToken: 8,
    topNWithBaseTokenInSet: false,
  },
  v3PoolSelection: {
    topN: 2,
    topNDirectSwaps: 2,
    topNTokenInOut: 3,
    topNSecondHop: 0,
    topNWithEachBaseToken: 3,
    topNWithBaseToken: 5,
    topNWithBaseTokenInSet: false,
  },
  maxSwapsPerPath: 3,
  minSplits: 1,
  maxSplits: 7,
  distributionPercent: 5,
  forceCrossProtocol: false,
}

export async function tokenStringToCurrency(
  tokenListProvider: ITokenListProvider,
  tokenProvider: ITokenProvider,
  tokenRaw: string,
  chainId: ChainId,
  log: Logger
): Promise<Currency | undefined> {
  const isAddress = (s: string) => s.length == 42 && s.startsWith('0x')

  let token: Currency | undefined = undefined

  if (tokenRaw == 'ETH' || tokenRaw.toLowerCase() == '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') {
    token = Ether.onChain(chainId)
  } else if (isAddress(tokenRaw)) {
    token = await tokenListProvider.getTokenByAddress(tokenRaw)
  }

  if (!token) {
    token = await tokenListProvider.getTokenBySymbol(tokenRaw)
  }

  if (token) {
    log.info(
      {
        tokenAddress: token.wrapped.address,
      },
      `Got input token from token list`
    )
    return token
  }

  log.info(`Getting input token ${tokenRaw} from chain`)
  if (!token && isAddress(tokenRaw)) {
    const tokenAccessor = await tokenProvider.getTokens([tokenRaw])
    return tokenAccessor.getTokenByAddress(tokenRaw)
  }

  return undefined
}
