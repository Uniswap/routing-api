import { Currency, Token } from '@uniswap/sdk-core'
import { ITokenListProvider, ITokenProvider, NATIVE_NAMES_BY_ID, nativeOnChain } from '@uniswap/smart-order-router'
import Logger from 'bunyan'
import { isAddress } from '../util/isAddress'

/**
 * CurrencyLookup searches native tokens, token lists, and on chain to determine
 * the token details (called Currency by the sdk) for an inputted string.
 */
export class CurrencyLookup {
  constructor(
    private readonly tokenListProvider: ITokenListProvider,
    private readonly tokenProvider: ITokenProvider,
    private readonly log: Logger
  ) {}

  public async searchForToken(tokenRaw: string, chainId: number): Promise<Currency | undefined> {
    if (NATIVE_NAMES_BY_ID[chainId]!.includes(tokenRaw)) {
      const nativeToken = nativeOnChain(chainId)
      this.log.debug(
        {
          tokenAddress: nativeToken.wrapped.address,
        },
        `Found native token ${tokenRaw} for chain ${chainId}: ${nativeToken.wrapped.address}}`
      )
      return nativeToken
    }

    // At this point, we know this is not a NativeCurrency based on the check above, so we can explicitly cast to Token.
    let token: Token | undefined = undefined
    if (isAddress(tokenRaw)) {
      token = await this.tokenListProvider.getTokenByAddress(tokenRaw)
    }

    if (!token) {
      token = await this.tokenListProvider.getTokenBySymbol(tokenRaw)
    }

    if (token) {
      this.log.debug(
        {
          tokenAddress: token.wrapped.address,
        },
        `Found token ${tokenRaw} in token lists.`
      )
      return token
    }

    this.log.debug(`Getting input token ${tokenRaw} from chain`)
    if (!token && isAddress(tokenRaw)) {
      const tokenAccessor = await this.tokenProvider.getTokens([tokenRaw])
      return tokenAccessor.getTokenByAddress(tokenRaw)
    }

    return undefined
  }
}
