import { Currency, Percent } from '@uniswap/sdk-core'
import {
  AlphaRouterConfig,
  ChainId,
  ITokenListProvider,
  ITokenProvider,
  MapWithLowerCaseKey,
  NATIVE_NAMES_BY_ID,
  nativeOnChain,
} from '@uniswap/smart-order-router'
import Logger from 'bunyan'

export const DEFAULT_ROUTING_CONFIG_BY_CHAIN = (chainId: ChainId): AlphaRouterConfig => {
  switch (chainId) {
    case ChainId.OPTIMISM:
      return {
        v2PoolSelection: {
          topN: 3,
          topNDirectSwaps: 1,
          topNTokenInOut: 5,
          topNSecondHop: 2,
          topNWithEachBaseToken: 2,
          topNWithBaseToken: 6,
        },
        v3PoolSelection: {
          topN: 2,
          topNDirectSwaps: 2,
          topNTokenInOut: 2,
          topNSecondHop: 1,
          topNWithEachBaseToken: 3,
          topNWithBaseToken: 3,
        },
        maxSwapsPerPath: 3,
        minSplits: 1,
        maxSplits: 7,
        distributionPercent: 10,
        forceCrossProtocol: false,
      }
    // Arbitrum calls have lower gas limits and tend to timeout more, which causes us to reduce the multicall
    // batch size and send more multicalls per quote. To reduce the amount of requests each quote sends, we
    // have to adjust the routing config so we explore fewer routes.
    case ChainId.ARBITRUM_ONE:
      return {
        v2PoolSelection: {
          topN: 3,
          topNDirectSwaps: 1,
          topNTokenInOut: 5,
          topNSecondHop: 2,
          topNWithEachBaseToken: 2,
          topNWithBaseToken: 6,
        },
        v3PoolSelection: {
          topN: 2,
          topNDirectSwaps: 2,
          topNTokenInOut: 2,
          topNSecondHop: 1,
          topNWithEachBaseToken: 3,
          topNWithBaseToken: 2,
        },
        maxSwapsPerPath: 2,
        minSplits: 1,
        maxSplits: 7,
        distributionPercent: 25,
        forceCrossProtocol: false,
      }
    default:
      return {
        v2PoolSelection: {
          topN: 3,
          topNDirectSwaps: 1,
          topNTokenInOut: 5,
          topNSecondHop: 2,
          topNWithEachBaseToken: 2,
          topNWithBaseToken: 6,
        },
        v3PoolSelection: {
          topN: 2,
          topNDirectSwaps: 2,
          topNTokenInOut: 3,
          topNSecondHop: 1,
          topNSecondHopForTokenAddress: new MapWithLowerCaseKey<number>([
            ['0x5f98805a4e8be255a32880fdec7f6728c6568ba0', 2], // LUSD
          ]),
          topNWithEachBaseToken: 3,
          topNWithBaseToken: 5,
        },
        maxSwapsPerPath: 3,
        minSplits: 1,
        maxSplits: 7,
        distributionPercent: 5,
        forceCrossProtocol: false,
      }
  }
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

  if (NATIVE_NAMES_BY_ID[chainId]!.includes(tokenRaw)) {
    token = nativeOnChain(chainId)
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

export function parseSlippageTolerance(slippageTolerance: string): Percent {
  const slippagePer10k = Math.round(parseFloat(slippageTolerance) * 100)
  return new Percent(slippagePer10k, 10_000)
}

export function parseDeadline(deadline: string): number {
  return Math.floor(Date.now() / 1000) + parseInt(deadline)
}
