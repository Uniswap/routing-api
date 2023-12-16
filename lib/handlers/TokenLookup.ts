import { Currency } from '@uniswap/sdk-core'
import { ITokenListProvider, ITokenProvider, NATIVE_NAMES_BY_ID, nativeOnChain } from '@uniswap/smart-order-router'
import Logger from 'bunyan'
import { isAddress } from '../util/isAddress'

export class TokenLookup {
  constructor(
    private readonly tokenListProvider: ITokenListProvider,
    private readonly tokenProvider: ITokenProvider,
    private readonly log: Logger
  ) {}

  public async tokenStringToCurrency(tokenRaw: string, chainId: number): Promise<Currency | undefined> {
    if (NATIVE_NAMES_BY_ID[chainId]!.includes(tokenRaw)) {
      const nativeToken = nativeOnChain(chainId)
      this.log.info(
        {
          tokenAddress: nativeToken.wrapped.address,
        },
        `Found address of native token ${tokenRaw} for chain ${chainId}: ${nativeToken.wrapped.address}}`
      )
      return nativeToken
    }

    let token: Currency | undefined = undefined
    if (isAddress(tokenRaw)) {
      token = await this.tokenListProvider.getTokenByAddress(tokenRaw)
    }

    if (!token) {
      token = await this.tokenListProvider.getTokenBySymbol(tokenRaw)
    }

    if (token) {
      this.log.info(
        {
          tokenAddress: token.wrapped.address,
        },
        `Got input token from token list`
      )
      return token
    }

    this.log.info(`Getting input token ${tokenRaw} from chain`)
    if (!token && isAddress(tokenRaw)) {
      const tokenAccessor = await this.tokenProvider.getTokens([tokenRaw])
      return tokenAccessor.getTokenByAddress(tokenRaw)
    }

    return undefined
  }
}
