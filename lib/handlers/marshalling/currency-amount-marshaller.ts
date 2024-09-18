import { CurrencyAmount, Token } from '@uniswap/sdk-core'
import { MarshalledCurrency, TokenMarshaller } from './token-marshaller'

export interface MarshalledCurrencyAmount {
  currency: MarshalledCurrency
  numerator: string
  denominator: string
}

export class CurrencyAmountMarshaller {
  public static marshal(currencyAmount: CurrencyAmount<Token>): MarshalledCurrencyAmount {
    return {
      currency: TokenMarshaller.marshal(currencyAmount.currency),
      numerator: currencyAmount.numerator.toString(),
      denominator: currencyAmount.denominator.toString(),
    }
  }

  public static unmarshal(marshalledCurrencyAmount: MarshalledCurrencyAmount): CurrencyAmount<Token> {
    return CurrencyAmount.fromFractionalAmount<Token>(
      TokenMarshaller.unmarshal(marshalledCurrencyAmount.currency),
      marshalledCurrencyAmount.numerator,
      marshalledCurrencyAmount.denominator
    )
  }
}
