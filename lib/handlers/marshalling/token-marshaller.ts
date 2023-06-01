import { Token } from '@uniswap/sdk-core'

export interface MarshalledToken {
  chainId: number
  address: string
  decimals: number
  symbol?: string
  name?: string
}

export class TokenMarshaller {
  public static marshal(token: Token): MarshalledToken {
    return {
      chainId: token.chainId,
      address: token.address,
      decimals: token.decimals,
      symbol: token.symbol,
      name: token.name,
    }
  }

  public static unmarshal(marshalledToken: MarshalledToken): Token {
    return new Token(
      marshalledToken.chainId,
      marshalledToken.address,
      marshalledToken.decimals,
      marshalledToken.symbol,
      marshalledToken.name
    )
  }
}
