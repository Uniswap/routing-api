import DEFAULT_TOKEN_LIST from '@uniswap/default-token-list';
import { Fraction } from '@uniswap/sdk-core';
import {
  CachingTokenListProvider,
  NodeJSCache,
} from '@uniswap/smart-order-router';
import axios, { AxiosResponse } from 'axios';
import { parseUnits } from 'ethers/lib/utils';
import JSBI from 'jsbi';
import NodeCache from 'node-cache';
import qs from 'qs';
import {
  QuoteToRatioQueryParams,
  QuoteToRatioResponse,
  ResponseFraction,
} from '../../lib/handlers/quote-to-ratio/schema/quote-to-ratio-schema';
import bn from 'bignumber.js'

const tokenListProvider = new CachingTokenListProvider(
  1,
  DEFAULT_TOKEN_LIST,
  new NodeJSCache(new NodeCache())
);

const API = `${process.env.UNISWAP_ROUTING_API!}quoteToRatio`;

// Try to parse a user entered amount for a given token
async function parseAmount(
  value: number,
  tokenAddress: string
): Promise<string> {
  const decimals = (await tokenListProvider.getTokenByAddress(tokenAddress))!
    .decimals;
  return parseUnits(value.toString(), decimals).toString();
}

function parseFraction(fraction: ResponseFraction): Fraction {
  return new Fraction(JSBI.BigInt(fraction.numerator), JSBI.BigInt(fraction.denominator))
}

describe('quote-to-ratio', () => {
  let token0Address: string;
  let token1Address: string;
  let token0Balance: string;
  let token1Balance: string;

  beforeEach(async () => {
    token0Address = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
    token1Address = '0xdac17f958d2ee523a2206206994597c13d831ec7';
    token0Balance = await parseAmount(5_000, token0Address);
    token1Balance = await parseAmount(2_000, token1Address);
  });

  test('erc20 -> erc20 large amount', async () => {
    const quoteToRatioRec: QuoteToRatioQueryParams = {
      token0Address,
      token0ChainId: 1,
      token1Address,
      token1ChainId: 1,
      token0Balance,
      token1Balance,
      tickLower: -60,
      tickUpper: 180,
      feeAmount: 500,
      recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
      slippageTolerance: '5',
      deadline: '360',
      errorTolerance: 1,
      maxIterations: 6,
    };

    const queryParams = qs.stringify(quoteToRatioRec);
    const response: AxiosResponse<QuoteToRatioResponse> =
      await axios.get<QuoteToRatioResponse>(`${API}?${queryParams}`);
    const {
      data: {
        amount,
        quote,
        tokenInAddress,
        tokenOutAddress,
        newRatio: newRatioRaw,
        optimalRatio: optimalRatioRaw,
        quoteDecimals,
        quoteGasAdjustedDecimals,
        methodParameters,
      },
      status,
    } = response;

    const newRatio = parseFraction(newRatioRaw)
    const optimalRatio =  parseFraction(optimalRatioRaw)

    expect(status).toBe(200);



    console.log('newRatio', newRatio.toFixed(10))
    console.log('optimal', optimalRatio.toFixed(10))
    console.log(response.data);
  });
});
