import { Currency, Token } from '@juiceswapxyz/sdk-core'
import { BigNumber } from 'ethers'
import { getAddress, nativeOnChain } from '@juiceswapxyz/smart-order-router'
import { isNativeCurrency } from '@juiceswapxyz/universal-router-sdk'

export interface MarshalledCurrency {
  chainId: number
  address: string
  decimals: number
  symbol?: string
  name?: string
  buyFeeBps?: string
  sellFeeBps?: string
}

export class TokenMarshaller {
  public static marshal(currency: Currency): MarshalledCurrency {
    return {
      chainId: currency.chainId,
      address: getAddress(currency),
      decimals: currency.decimals,
      symbol: currency.symbol,
      name: currency.name,
      buyFeeBps: currency.isToken ? currency.buyFeeBps?.toString() : undefined,
      sellFeeBps: currency.isToken ? currency.sellFeeBps?.toString() : undefined,
    }
  }

  public static unmarshal(marshalledCurrency: MarshalledCurrency): Currency {
    return isNativeCurrency(marshalledCurrency.address)
      ? nativeOnChain(marshalledCurrency.chainId)
      : new Token(
          marshalledCurrency.chainId,
          marshalledCurrency.address,
          marshalledCurrency.decimals,
          marshalledCurrency.symbol,
          marshalledCurrency.name,
          true, // at this point we know it's valid token address
          marshalledCurrency.buyFeeBps ? BigNumber.from(marshalledCurrency.buyFeeBps) : undefined,
          marshalledCurrency.sellFeeBps ? BigNumber.from(marshalledCurrency.sellFeeBps) : undefined
        )
  }
}
