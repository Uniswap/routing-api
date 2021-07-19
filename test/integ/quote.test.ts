import DEFAULT_TOKEN_LIST from '@uniswap/default-token-list';
import { TokenListProvider } from '@uniswap/smart-order-router';
import axios, { AxiosResponse } from 'axios';
import { ethers } from 'ethers';
import {
  QuoteBody,
  QuoteResponse,
} from '../../lib/handlers/quote/schema/quote-schema';

const tokenListProvider = new TokenListProvider(DEFAULT_TOKEN_LIST);

const getAmount = (
  type: string,
  symbolIn: string,
  symbolOut: string,
  amount: string
) => {
  const decimals = tokenListProvider.getTokenBySymbol(
    1,
    type == 'exactIn' ? symbolIn : symbolOut
  ).decimals;
  return ethers.utils.parseUnits(amount, decimals).toString();
};

const API = `${process.env.UNISWAP_ROUTING_API!}quote`;

describe.each([['alpha'], ['legacy']])('quote %s', (algorithm: string) => {
  describe.each([['exactIn'], ['exactOut']])('2xx %s', (type: string) => {
    test('erc20 -> erc20', async () => {
      const quotePost: QuoteBody = {
        tokenIn: { address: 'USDC', chainId: 1 },
        tokenOut: { address: 'USDT', chainId: 1 },
        amount: getAmount(type, 'USDC', 'USDT', '100'),
        type,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        algorithm,
      };

      const response: AxiosResponse<QuoteResponse> =
        await axios.post<QuoteResponse>(API, quotePost);
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

    test('erc20 -> eth', async () => {
      const quotePost: QuoteBody = {
        tokenIn: { address: 'USDC', chainId: 1 },
        tokenOut: { address: 'ETH', chainId: 1 },
        amount: getAmount(type, 'USDC', 'ETH', '100'),
        type,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        algorithm,
      };

      const response = await axios.post<QuoteResponse>(API, quotePost);
      const { data, status } = response;

      expect(status).toBe(200);
      expect(data.methodParameters).toBeDefined();
    });

    test('eth -> erc20', async () => {
      const quotePost: QuoteBody = {
        tokenIn: { address: 'ETH', chainId: 1 },
        tokenOut: { address: 'UNI', chainId: 1 },
        amount: getAmount(type, 'ETH', 'UNI', '10'),
        type,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        algorithm,
      };

      const response = await axios.post<QuoteResponse>(API, quotePost);
      const { data, status } = response;

      expect(status).toBe(200);
      expect(data.methodParameters).toBeDefined();
    });

    test('weth -> erc20', async () => {
      const quotePost: QuoteBody = {
        tokenIn: { address: 'WETH', chainId: 1 },
        tokenOut: { address: 'DAI', chainId: 1 },
        amount: getAmount(type, 'WETH', 'DAI', '100'),
        type,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        algorithm,
      };

      const response = await axios.post<QuoteResponse>(API, quotePost);
      const { data, status } = response;

      expect(status).toBe(200);
      expect(data.methodParameters).toBeDefined();
    });

    test('erc20 -> weth', async () => {
      const quotePost: QuoteBody = {
        tokenIn: { address: 'USDT', chainId: 1 },
        tokenOut: { address: 'WETH', chainId: 1 },
        amount: getAmount(type, 'USDT', 'WETH', '100'),
        type,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        algorithm,
      };

      const response = await axios.post<QuoteResponse>(API, quotePost);
      const { data, status } = response;

      expect(status).toBe(200);
      expect(data.methodParameters).toBeDefined();
    });

    test('erc20 -> erc20 by address', async () => {
      const quotePost: QuoteBody = {
        tokenIn: {
          address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
          chainId: 1,
        }, // DAI
        tokenOut: {
          address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          chainId: 1,
        }, // USDC
        amount: getAmount(type, 'DAI', 'USDC', '100'),
        type,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        algorithm,
      };

      const response: AxiosResponse<QuoteResponse> =
        await axios.post<QuoteResponse>(API, quotePost);

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
      const quotePost: QuoteBody = {
        tokenIn: {
          address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
          chainId: 1,
        }, // DAI
        tokenOut: {
          address: 'USDC',
          chainId: 1,
        }, // USDC
        amount: getAmount(type, 'DAI', 'USDC', '100'),
        type,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        algorithm,
      };

      const response: AxiosResponse<QuoteResponse> =
        await axios.post<QuoteResponse>(API, quotePost);
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
      const quotePost: Partial<QuoteBody> = {
        tokenOut: { address: 'USDT', chainId: 1 },
        amount: getAmount(type, 'USDC', 'USDT', '100'),
        type,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        algorithm,
      };

      await expect(
        axios.post<QuoteResponse>(API, quotePost)
      ).rejects.toMatchObject({
        response: {
          status: 400,
          data: {
            detail: '"tokenIn" is required',
            errorCode: 'VALIDATION_ERROR',
          },
        },
      });
    });

    test('amount is too big to find route', async () => {
      const quotePost: QuoteBody = {
        tokenIn: { address: 'ETH', chainId: 1 },
        tokenOut: { address: 'UNI', chainId: 1 },
        amount: getAmount(type, 'ETH', 'UNI', '1000000000000000000000000000'),
        type,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        algorithm,
      };

      await expect(
        axios.post<QuoteResponse>(API, quotePost)
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
      const quotePost: QuoteBody = {
        tokenIn: { address: 'USDC', chainId: 1 },
        tokenOut: { address: 'USDT', chainId: 1 },
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

      await expect(
        axios.post<QuoteResponse>(API, quotePost)
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
      const quotePost: QuoteBody = {
        tokenIn: { address: 'USDC', chainId: 1 },
        tokenOut: { address: 'USDT', chainId: 1 },
        amount: '-10000000000',
        type,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        algorithm,
      };

      await expect(
        axios.post<QuoteResponse>(API, quotePost)
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
      const quotePost: QuoteBody = {
        tokenIn: { address: 'USDC', chainId: 1 },
        tokenOut: { address: 'USDT', chainId: 1 },
        amount: '1000000000.25',
        type,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        algorithm,
      };

      await expect(
        axios.post<QuoteResponse>(API, quotePost)
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
      const quotePost: QuoteBody = {
        tokenIn: { address: 'USDC', chainId: 1 },
        tokenOut: { address: 'NONEXISTANTTOKEN', chainId: 1 },
        amount: getAmount(type, 'USDC', 'USDT', '100'),
        type,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        algorithm,
      };

      await expect(
        axios.post<QuoteResponse>(API, quotePost)
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
      const quotePost: QuoteBody = {
        tokenIn: { address: 'USDT', chainId: 1 },
        tokenOut: { address: 'USDT', chainId: 1 },
        amount: getAmount(type, 'USDC', 'USDT', '100'),
        type,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        algorithm,
      };

      await expect(
        axios.post<QuoteResponse>(API, quotePost)
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
      const quotePost: QuoteBody = {
        tokenIn: { address: 'USDT', chainId: 1 },
        tokenOut: {
          address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
          chainId: 1,
        },
        amount: getAmount(type, 'USDT', 'USDT', '100'),
        type,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        algorithm,
      };

      await expect(
        axios.post<QuoteResponse>(API, quotePost)
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
      const quotePost: QuoteBody = {
        tokenIn: {
          address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
          chainId: 1,
        },
        tokenOut: {
          address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
          chainId: 1,
        },
        amount: getAmount(type, 'USDT', 'USDT', '100'),
        type,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        algorithm,
      };

      await expect(
        axios.post<QuoteResponse>(API, quotePost)
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

    test('recipient is an invalid address', async () => {
      const quotePost: QuoteBody = {
        tokenIn: {
          address: 'USDT',
          chainId: 1,
        },
        tokenOut: {
          address: 'USDC',
          chainId: 1,
        },
        amount: getAmount(type, 'USDT', 'USDC', '100'),
        type,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aZZZZZZZ',
        slippageTolerance: '5',
        deadline: '360',
        algorithm,
      };

      await expect(
        axios.post<QuoteResponse>(API, quotePost)
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
