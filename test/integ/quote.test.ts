import DEFAULT_TOKEN_LIST from '@uniswap/default-token-list';
import { TokenListProvider } from '@uniswap/smart-order-router';
import axios, { AxiosResponse } from 'axios';
import { BigNumber, ethers } from 'ethers';
import _ from 'lodash';
import qs from 'qs';
import {
  QuoteQueryParams,
  QuoteResponse,
} from '../../lib/handlers/quote/schema/quote-schema';

const tokenListProvider = new TokenListProvider(1, DEFAULT_TOKEN_LIST);

const getAmount = (
  type: string,
  symbolIn: string,
  symbolOut: string,
  amount: string
) => {
  const decimals = tokenListProvider.getTokenBySymbol(
    type == 'exactIn' ? symbolIn : symbolOut
  )!.decimals;
  return ethers.utils.parseUnits(amount, decimals).toString();
};

const API = `${process.env.UNISWAP_ROUTING_API!}quote`;

describe.each([['alpha'], ['legacy']])('quote %s', (algorithm: string) => {
  describe.each([['exactIn'], ['exactOut']])('2xx %s', (type: string) => {
    test('erc20 -> erc20', async () => {
      const quoteReq: QuoteQueryParams = {
        tokenInAddress: 'USDC',
        tokenInChainId: 1,
        tokenOutAddress: 'USDT',
        tokenOutChainId: 1,
        amount: getAmount(type, 'USDC', 'USDT', '100'),
        type,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        algorithm,
      };

      const queryParams = qs.stringify(quoteReq);

      const response: AxiosResponse<QuoteResponse> =
        await axios.get<QuoteResponse>(`${API}?${queryParams}`);
      const {
        data: { quoteDecimals, quoteGasAdjustedDecimals, methodParameters },
        status,
      } = response;

      expect(status).toBe(200);
      expect(parseFloat(quoteDecimals)).toBeGreaterThan(90);
      expect(parseFloat(quoteDecimals)).toBeLessThan(110);

      if (type == 'exactIn') {
        expect(parseFloat(quoteGasAdjustedDecimals)).toBeLessThanOrEqual(
          parseFloat(quoteDecimals)
        );
      } else {
        expect(parseFloat(quoteGasAdjustedDecimals)).toBeGreaterThanOrEqual(
          parseFloat(quoteDecimals)
        );
      }

      expect(methodParameters).toBeDefined();
    });

    test('erc20 -> erc20 no recipient/deadline/slippage', async () => {
      const quoteReq: QuoteQueryParams = {
        tokenInAddress: 'USDC',
        tokenInChainId: 1,
        tokenOutAddress: 'USDT',
        tokenOutChainId: 1,
        amount: getAmount(type, 'USDC', 'USDT', '100'),
        type,
        algorithm,
      };

      const queryParams = qs.stringify(quoteReq);

      const response: AxiosResponse<QuoteResponse> =
        await axios.get<QuoteResponse>(`${API}?${queryParams}`);
      const {
        data: { quoteDecimals, quoteGasAdjustedDecimals, methodParameters },
        status,
      } = response;

      expect(status).toBe(200);
      expect(parseFloat(quoteDecimals)).toBeGreaterThan(90);
      expect(parseFloat(quoteDecimals)).toBeLessThan(110);

      if (type == 'exactIn') {
        expect(parseFloat(quoteGasAdjustedDecimals)).toBeLessThanOrEqual(
          parseFloat(quoteDecimals)
        );
      } else {
        expect(parseFloat(quoteGasAdjustedDecimals)).toBeGreaterThanOrEqual(
          parseFloat(quoteDecimals)
        );
      }

      expect(methodParameters).not.toBeDefined();
    });

    test('erc20 -> eth', async () => {
      const quoteReq: QuoteQueryParams = {
        tokenInAddress: 'USDC',
        tokenInChainId: 1,
        tokenOutAddress: 'ETH',
        tokenOutChainId: 1,
        amount: getAmount(type, 'USDC', 'ETH', '100'),
        type,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        algorithm,
      };

      const queryParams = qs.stringify(quoteReq);

      const response = await axios.get<QuoteResponse>(`${API}?${queryParams}`);
      const { data, status } = response;

      expect(status).toBe(200);
      expect(data.methodParameters).toBeDefined();
    });

    test('erc20 -> eth large trade', async () => {
      // Trade of this size almost always results in splits.
      const quoteReq: QuoteQueryParams = {
        tokenInAddress: 'USDC',
        tokenInChainId: 1,
        tokenOutAddress: 'ETH',
        tokenOutChainId: 1,
        amount:
          type == 'exactIn'
            ? getAmount(type, 'USDC', 'ETH', '2000000')
            : getAmount(type, 'USDC', 'ETH', '1000'),
        type,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        algorithm,
      };

      const queryParams = qs.stringify(quoteReq);

      const response = await axios.get<QuoteResponse>(`${API}?${queryParams}`);
      const { data, status } = response;

      expect(status).toBe(200);
      expect(data.methodParameters).toBeDefined();

      const amountInEdgesTotal = _(data.routeEdges)
        .filter((routeEdge) => !!routeEdge.amountIn)
        .map((routeEdge) => BigNumber.from(routeEdge.amountIn))
        .reduce((cur, total) => total.add(cur), BigNumber.from(0));
      const amountIn = BigNumber.from(data.quote);
      expect(amountIn.eq(amountInEdgesTotal));

      const amountOutEdgesTotal = _(data.routeEdges)
        .filter((routeEdge) => !!routeEdge.amountOut)
        .map((routeEdge) => BigNumber.from(routeEdge.amountOut))
        .reduce((cur, total) => total.add(cur), BigNumber.from(0));
      const amountOut = BigNumber.from(data.quote);
      expect(amountOut.eq(amountOutEdgesTotal));
      expect(data.routeEdges).toBeDefined();
    });

    test('eth -> erc20', async () => {
      const quoteReq: QuoteQueryParams = {
        tokenInAddress: 'ETH',
        tokenInChainId: 1,
        tokenOutAddress: 'UNI',
        tokenOutChainId: 1,
        amount: getAmount(type, 'ETH', 'UNI', '10'),
        type,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        algorithm,
      };

      const queryParams = qs.stringify(quoteReq);

      const response = await axios.get<QuoteResponse>(`${API}?${queryParams}`);
      const { data, status } = response;

      expect(status).toBe(200);
      expect(data.methodParameters).toBeDefined();
    });

    test('weth -> erc20', async () => {
      const quoteReq: QuoteQueryParams = {
        tokenInAddress: 'WETH',
        tokenInChainId: 1,
        tokenOutAddress: 'DAI',
        tokenOutChainId: 1,
        amount: getAmount(type, 'WETH', 'DAI', '100'),
        type,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        algorithm,
      };

      const queryParams = qs.stringify(quoteReq);

      const response = await axios.get<QuoteResponse>(`${API}?${queryParams}`);
      const { data, status } = response;

      expect(status).toBe(200);
      expect(data.methodParameters).toBeDefined();
    });

    test('erc20 -> weth', async () => {
      const quoteReq: QuoteQueryParams = {
        tokenInAddress: 'USDT',
        tokenInChainId: 1,
        tokenOutAddress: 'WETH',
        tokenOutChainId: 1,
        amount: getAmount(type, 'USDT', 'WETH', '100'),
        type,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        algorithm,
      };

      const queryParams = qs.stringify(quoteReq);

      const response = await axios.get<QuoteResponse>(`${API}?${queryParams}`);
      const { data, status } = response;

      expect(status).toBe(200);
      expect(data.methodParameters).toBeDefined();
    });

    test('erc20 -> erc20 by address', async () => {
      const quoteReq: QuoteQueryParams = {
        tokenInAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        tokenInChainId: 1, // DAI
        tokenOutAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        tokenOutChainId: 1, // USDC
        amount: getAmount(type, 'DAI', 'USDC', '100'),
        type,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        algorithm,
      };

      const queryParams = qs.stringify(quoteReq);

      const response: AxiosResponse<QuoteResponse> =
        await axios.get<QuoteResponse>(`${API}?${queryParams}`);

      const {
        data: { quoteDecimals, quoteGasAdjustedDecimals },
        status,
      } = response;

      expect(status).toBe(200);
      expect(parseFloat(quoteDecimals)).toBeGreaterThan(90);

      if (type == 'exactIn') {
        expect(parseFloat(quoteGasAdjustedDecimals)).toBeLessThanOrEqual(
          parseFloat(quoteDecimals)
        );
      } else {
        expect(parseFloat(quoteGasAdjustedDecimals)).toBeGreaterThanOrEqual(
          parseFloat(quoteDecimals)
        );
      }

      expect(parseFloat(quoteDecimals)).toBeLessThan(110);
    });

    test('erc20 -> erc20 one by address one by symbol', async () => {
      const quoteReq: QuoteQueryParams = {
        tokenInAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        tokenInChainId: 1,
        tokenOutAddress: 'USDC',
        tokenOutChainId: 1,
        amount: getAmount(type, 'DAI', 'USDC', '100'),
        type,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        algorithm,
      };

      const queryParams = qs.stringify(quoteReq);

      const response: AxiosResponse<QuoteResponse> =
        await axios.get<QuoteResponse>(`${API}?${queryParams}`);
      const {
        data: { quoteDecimals, quoteGasAdjustedDecimals },
        status,
      } = response;

      expect(status).toBe(200);
      expect(parseFloat(quoteDecimals)).toBeGreaterThan(90);

      if (type == 'exactIn') {
        expect(parseFloat(quoteGasAdjustedDecimals)).toBeLessThanOrEqual(
          parseFloat(quoteDecimals)
        );
      } else {
        expect(parseFloat(quoteGasAdjustedDecimals)).toBeGreaterThanOrEqual(
          parseFloat(quoteDecimals)
        );
      }

      expect(parseFloat(quoteDecimals)).toBeLessThan(110);
    });
  });

  describe.each([['exactIn'], ['exactOut']])('4xx %s', (type: string) => {
    test('field is missing in body', async () => {
      const quoteReq: Partial<QuoteQueryParams> = {
        tokenOutAddress: 'USDT',
        tokenInChainId: 1,
        tokenOutChainId: 1,
        amount: getAmount(type, 'USDC', 'USDT', '100'),
        type,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        algorithm,
      };

      const queryParams = qs.stringify(quoteReq);

      await expect(
        axios.get<QuoteResponse>(`${API}?${queryParams}`)
      ).rejects.toMatchObject({
        response: {
          status: 400,
          data: {
            detail: '"tokenInAddress" is required',
            errorCode: 'VALIDATION_ERROR',
          },
        },
      });
    });

    test('amount is too big to find route', async () => {
      const quoteReq: QuoteQueryParams = {
        tokenInAddress: 'ETH',
        tokenInChainId: 1,
        tokenOutAddress: 'UNI',
        tokenOutChainId: 1,
        amount: getAmount(type, 'ETH', 'UNI', '1000000000000000000000000000'),
        type,
        recipient: '0x88fc765949a27405480F374Aa49E20dcCD3fCfb8',
        slippageTolerance: '5',
        deadline: '360',
        algorithm,
      };

      const queryParams = qs.stringify(quoteReq);

      await expect(
        axios.get<QuoteResponse>(`${API}?${queryParams}`)
      ).rejects.toMatchObject({
        response: {
          status: 404,
          data: {
            detail: 'No route found',
            errorCode: 'NO_ROUTE',
          },
        },
      });
    });

    test('amount is too big for uint256', async () => {
      const quoteReq: QuoteQueryParams = {
        tokenInAddress: 'USDC',
        tokenInChainId: 1,
        tokenOutAddress: 'USDT',
        tokenOutChainId: 1,
        amount: getAmount(
          type,
          'USDC',
          'USDT',
          '100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'
        ),
        type,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        algorithm,
      };

      const queryParams = qs.stringify(quoteReq);

      await expect(
        axios.get<QuoteResponse>(`${API}?${queryParams}`)
      ).rejects.toMatchObject({
        response: {
          status: 400,
          data: {
            detail:
              '"amount" length must be less than or equal to 77 characters long',
            errorCode: 'VALIDATION_ERROR',
          },
        },
      });
    });

    test('amount is negative', async () => {
      const quoteReq: QuoteQueryParams = {
        tokenInAddress: 'USDC',
        tokenInChainId: 1,
        tokenOutAddress: 'USDT',
        tokenOutChainId: 1,
        amount: '-10000000000',
        type,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        algorithm,
      };

      const queryParams = qs.stringify(quoteReq);

      await expect(
        axios.get<QuoteResponse>(`${API}?${queryParams}`)
      ).rejects.toMatchObject({
        response: {
          status: 400,
          data: {
            detail:
              '"amount" with value "-10000000000" fails to match the required pattern: /^[0-9]+$/',
            errorCode: 'VALIDATION_ERROR',
          },
        },
      });
    });

    test('amount is decimal', async () => {
      const quoteReq: QuoteQueryParams = {
        tokenInAddress: 'USDC',
        tokenInChainId: 1,
        tokenOutAddress: 'USDT',
        tokenOutChainId: 1,
        amount: '1000000000.25',
        type,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        algorithm,
      };

      const queryParams = qs.stringify(quoteReq);

      await expect(
        axios.get<QuoteResponse>(`${API}?${queryParams}`)
      ).rejects.toMatchObject({
        response: {
          status: 400,
          data: {
            detail:
              '"amount" with value "1000000000.25" fails to match the required pattern: /^[0-9]+$/',
            errorCode: 'VALIDATION_ERROR',
          },
        },
      });
    });

    test('symbol doesnt exist', async () => {
      const quoteReq: QuoteQueryParams = {
        tokenInAddress: 'USDC',
        tokenInChainId: 1,
        tokenOutAddress: 'NONEXISTANTTOKEN',
        tokenOutChainId: 1,
        amount: getAmount(type, 'USDC', 'USDT', '100'),
        type,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        algorithm,
      };

      const queryParams = qs.stringify(quoteReq);

      await expect(
        axios.get<QuoteResponse>(`${API}?${queryParams}`)
      ).rejects.toMatchObject({
        response: {
          status: 400,
          data: {
            detail: 'Could not find token with address "NONEXISTANTTOKEN"',
            errorCode: 'TOKEN_OUT_INVALID',
          },
        },
      });
    });

    test('tokens are the same symbol', async () => {
      const quoteReq: QuoteQueryParams = {
        tokenInAddress: 'USDT',
        tokenInChainId: 1,
        tokenOutAddress: 'USDT',
        tokenOutChainId: 1,
        amount: getAmount(type, 'USDC', 'USDT', '100'),
        type,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        algorithm,
      };

      const queryParams = qs.stringify(quoteReq);

      await expect(
        axios.get<QuoteResponse>(`${API}?${queryParams}`)
      ).rejects.toMatchObject({
        response: {
          status: 400,
          data: {
            detail: 'tokenIn and tokenOut must be different',
            errorCode: 'TOKEN_IN_OUT_SAME',
          },
        },
      });
    });

    test('tokens are the same symbol and address', async () => {
      const quoteReq: QuoteQueryParams = {
        tokenInAddress: 'USDT',
        tokenInChainId: 1,
        tokenOutAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        tokenOutChainId: 1,
        amount: getAmount(type, 'USDT', 'USDT', '100'),
        type,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        algorithm,
      };

      const queryParams = qs.stringify(quoteReq);

      await expect(
        axios.get<QuoteResponse>(`${API}?${queryParams}`)
      ).rejects.toMatchObject({
        response: {
          status: 400,
          data: {
            detail: 'tokenIn and tokenOut must be different',
            errorCode: 'TOKEN_IN_OUT_SAME',
          },
        },
      });
    });

    test('tokens are the same address', async () => {
      const quoteReq: QuoteQueryParams = {
        tokenInAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        tokenInChainId: 1,
        tokenOutAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        tokenOutChainId: 1,
        amount: getAmount(type, 'USDT', 'USDT', '100'),
        type,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        algorithm,
      };

      const queryParams = qs.stringify(quoteReq);

      await expect(
        axios.get<QuoteResponse>(`${API}?${queryParams}`)
      ).rejects.toMatchObject({
        response: {
          status: 400,
          data: {
            detail: 'tokenIn and tokenOut must be different',
            errorCode: 'TOKEN_IN_OUT_SAME',
          },
        },
      });
    });

    test('one of recipient/deadline/slippage is missing', async () => {
      const quoteReq: QuoteQueryParams = {
        tokenInAddress: 'USDC',
        tokenInChainId: 1,
        tokenOutAddress: 'USDT',
        tokenOutChainId: 1,
        amount: getAmount(type, 'USDC', 'USDT', '100'),
        type,
        slippageTolerance: '5',
        deadline: '360',
        algorithm,
      };

      const queryParams = qs.stringify(quoteReq);

      await expect(
        axios.get<QuoteResponse>(`${API}?${queryParams}`)
      ).rejects.toMatchObject({
        response: {
          status: 400,
          data: {
            detail:
              '"value" contains [slippageTolerance, deadline] without its required peers [recipient]',
            errorCode: 'VALIDATION_ERROR',
          },
        },
      });
    });

    test('recipient is an invalid address', async () => {
      const quoteReq: QuoteQueryParams = {
        tokenInAddress: 'USDT',
        tokenInChainId: 1,
        tokenOutAddress: 'USDC',
        tokenOutChainId: 1,
        amount: getAmount(type, 'USDT', 'USDC', '100'),
        type,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aZZZZZZZ',
        slippageTolerance: '5',
        deadline: '360',
        algorithm,
      };

      const queryParams = qs.stringify(quoteReq);

      await expect(
        axios.get<QuoteResponse>(`${API}?${queryParams}`)
      ).rejects.toMatchObject({
        response: {
          status: 400,
          data: {
            detail:
              '"recipient" with value "0xAb5801a7D398351b8bE11C439e05C5B3259aZZZZZZZ" fails to match the required pattern: /^0x[a-fA-F0-9]{40}$/',
            errorCode: 'VALIDATION_ERROR',
          },
        },
      });
    });
  });
});
