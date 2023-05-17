import { Pair } from '@uniswap/v2-sdk'
import { CurrencyAmountMarshaller, MarshalledCurrencyAmount } from './currency-amount-marshaller'
import { Protocol } from '@uniswap/router-sdk'

export interface MarshalledPair {
  protocol: Protocol
  currencyAmountA: MarshalledCurrencyAmount
  tokenAmountB: MarshalledCurrencyAmount
}

export class PairMarshaller {
  public static marshal(pair: Pair): MarshalledPair {
    return {
      protocol: Protocol.V2,
      currencyAmountA: CurrencyAmountMarshaller.marshal(pair.reserve0),
      tokenAmountB: CurrencyAmountMarshaller.marshal(pair.reserve1),
    }
  }

  public static unmarshal(marshalledPair: MarshalledPair): Pair {
    return new Pair(
      CurrencyAmountMarshaller.unmarshal(marshalledPair.currencyAmountA),
      CurrencyAmountMarshaller.unmarshal(marshalledPair.tokenAmountB)
    )
  }
}
