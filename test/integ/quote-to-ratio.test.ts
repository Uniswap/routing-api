import DEFAULT_TOKEN_LIST from '@uniswap/default-token-list';
import { CachingTokenListProvider, NodeJSCache } from '@uniswap/smart-order-router';
import axios, { AxiosResponse } from 'axios';
import { BigNumber, ethers } from 'ethers';
import _ from 'lodash';
import NodeCache from 'node-cache';
import qs from 'qs';
import {
  QuoteToRatioQueryParams,
} from '../../lib/handlers/quote-to-ratio/schema/quote-to-ratio-schema';
import{
  QuoteResponse,
} from '../../lib/handlers/schema';

const tokenListProvider = new CachingTokenListProvider(1, DEFAULT_TOKEN_LIST, new NodeJSCache(new NodeCache()));

const API = `${process.env.UNISWAP_ROUTING_API!}quote`;

describe('quote-to-ratio', () => {
	test('erc20 -> erc20', async () => {
		const quoteToRatioRec: QuoteToRatioQueryParams = {
			token0Address: 'USDC',
			token0ChainId: 1,
			token1Address: 'USDT',
			token1ChainId: 1,
			token0Balance: 1000,
			token1Balance: 1000,
			tickLower: 0,
			tickUpper: 60,
			feeAmount: 3000,
			recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
			slippageTolerance: '5',
			deadline: '360',
      errorTolerance: 1,
      maxIterations: 6,
		}
	})
})
