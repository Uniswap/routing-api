import { Token } from '@uniswap/sdk-core'
import { BigNumber } from 'ethers'

export interface MarshalledToken {
  chainId: number
  address: string
  decimals: number
  symbol?: string
  name?: string
  buyFeeBps?: BigNumber
  sellFeeBps?: BigNumber
}

export class TokenMarshaller {
  public static marshal(token: Token): MarshalledToken {
    return {
      chainId: token.chainId,
      address: token.address,
      decimals: token.decimals,
      symbol: token.symbol,
      name: token.name,
      buyFeeBps: token.buyFeeBps,
      sellFeeBps: token.sellFeeBps,
    }
  }

  public static unmarshal(marshalledToken: MarshalledToken): Token {
    return new Token(
      marshalledToken.chainId,
      marshalledToken.address,
      marshalledToken.decimals,
      marshalledToken.symbol,
      marshalledToken.name,
      true, // at this point we know it's valid token address
      marshalledToken.buyFeeBps,
      marshalledToken.sellFeeBps
    )
  }
}
