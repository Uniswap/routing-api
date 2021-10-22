import DEFAULT_TOKEN_LIST from '@uniswap/default-token-list';
import { CachingTokenListProvider, NodeJSCache } from '@uniswap/smart-order-router';
import { SqrtPriceMath } from '@uniswap/v3-sdk';

import axios, { AxiosResponse } from 'axios';
import { BigNumber, ethers } from 'ethers';
import _ from 'lodash';
import NodeCache from 'node-cache';
import qs from 'qs';
import {
  QuoteToRatioQueryParams,
  QuoteToRatioResponse,
} from '../../lib/handlers/quote-to-ratio/schema/quote-to-ratio-schema';


const tokenListProvider = new CachingTokenListProvider(1, DEFAULT_TOKEN_LIST, new NodeJSCache(new NodeCache()));

const API = `${process.env.UNISWAP_ROUTING_API!}quoteToRatio`;

describe('quote-to-ratio', () => {
	test('erc20 -> erc20', async () => {
		const quoteToRatioRec: QuoteToRatioQueryParams = {
			token0Address: 'USDC',
			token0ChainId: 1,
			token1Address: 'USDT',
			token1ChainId: 1,
			token0Balance: 500_000_000_000,
			token1Balance: 1_000_000_000,
			tickLower: -60,
			tickUpper: 180,
			feeAmount: 500,
			recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
			slippageTolerance: '5',
			deadline: '360',
      errorTolerance: 1,
      maxIterations: 6,
		}

    const queryParams = qs.stringify(quoteToRatioRec)
    const response: AxiosResponse<QuoteToRatioResponse> =
      await axios.get<QuoteToRatioResponse>(`${API}?${queryParams}`);
    const {
      data: { amount, quote, tokenIn, tokenOut, quoteDecimals, quoteGasAdjustedDecimals, methodParameters },
      status,
    } = response;

    expect(status).toBe(200);
    console.log(response.data)
    console.log("amount", amount)
    console.log("amountDecimals", response.data.amountDecimals)
    console.log("route", response.data.route)
    console.log("tokenIn", tokenIn)
    console.log("tokenOut", tokenOut)

    // let ratio
    // if (tokenIn == token0Address) {
    //   const precision = JSBI.BigInt('1' + '0'.repeat(18))
    //   let optimalRatio =  new Fraction(
    //     SqrtPriceMath.getAmount0Delta(
    //       sqrtRatioX96,
    //       upperSqrtRatioX96,
    //       precision,
    //       true
    //     ),
    //     SqrtPriceMath.getAmount1Delta(
    //       sqrtRatioX96,
    //       lowerSqrtRatioX96,
    //       precision,
    //       true
    //     )
    //   )
    //   if (!zeroForOne) optimalRatio = optimalRatio.invert()
    // }

    // check that new ratio is within error tolerance
    //
	})
})
// 
// function optimalRatio(tickLower: number, tickUpper: number, sqrtRatioX96: JSBI, zeroForOne: boolean): Fraction {
//   const lowerSqrtRatioX96 = TickMath.getSqrtRatioAtTick(tickLower);
//   const upperSqrtRatioX96 = TickMath.getSqrtRatioAtTick(tickUpper);
//
//   // returns Fraction(0, 1) for any out of range position regardless of zeroForOne. Implication: function
//   // cannot be used to determine the trading direction of out of range positions.
//   if (JSBI.greaterThan(sqrtRatioX96, upperSqrtRatioX96) || JSBI.lessThan(sqrtRatioX96, lowerSqrtRatioX96)) {
//     return new Fraction(0,1)
//   }
//
//   const precision = JSBI.BigInt('1' + '0'.repeat(18))
//   let optimalRatio =  new Fraction(
//     SqrtPriceMath.getAmount0Delta(
//       sqrtRatioX96,
//       upperSqrtRatioX96,
//       precision,
//       true
//     ),
//     SqrtPriceMath.getAmount1Delta(
//       sqrtRatioX96,
//       lowerSqrtRatioX96,
//       precision,
//       true
//     )
//   )
//   if (!zeroForOne) optimalRatio = optimalRatio.invert()
//   return optimalRatio
// }
