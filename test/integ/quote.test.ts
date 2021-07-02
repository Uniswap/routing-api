import axios, { AxiosResponse } from 'axios';
import {
  QuoteBody,
  QuoteResponse,
} from '../../lib/handlers/quote/schema/quote-schema';

const API = `${process.env.UNISWAP_ROUTING_API!}quote`;

describe.each([['alpha'], ['legacy']])('quote %s', (algorithm: string) => {
  describe.each([['exactIn'], ['exactOut']])('2xx %s', (type: string) => {
    test('succeeds erc20 -> erc20', async () => {
      const quotePost: QuoteBody = {
        tokenIn: 'USDC',
        tokenOut: 'USDT',
        amount: '100',
        type,
        chainId: 1,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        algorithm,
      };

      const response: AxiosResponse<QuoteResponse> = await axios.post<QuoteResponse>(
        API,
        quotePost
      );
      const {
        data: { quote, quoteGasAdjusted },
        status,
      } = response;

      expect(status).toBe(200);
      expect(parseFloat(quote)).toBeGreaterThan(90);

      if (type == 'exactIn') {
        expect(parseFloat(quoteGasAdjusted)).toBeLessThanOrEqual(
          parseFloat(quote)
        );
      } else {
        expect(parseFloat(quoteGasAdjusted)).toBeGreaterThanOrEqual(
          parseFloat(quote)
        );
      }

      expect(parseFloat(quote)).toBeLessThan(110);
    });

    test('succeeds erc20 -> eth', async () => {
      const quotePost: QuoteBody = {
        tokenIn: 'USDC',
        tokenOut: 'ETH',
        amount: '100',
        type,
        chainId: 1,
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

    test('succeeds eth -> erc20', async () => {
      const quotePost: QuoteBody = {
        tokenIn: 'ETH',
        tokenOut: 'UNI',
        amount: '100',
        type,
        chainId: 1,
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

    test('succeeds weth -> erc20', async () => {
      const quotePost: QuoteBody = {
        tokenIn: 'WETH',
        tokenOut: 'DAI',
        amount: '100',
        type,
        chainId: 1,
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

    test('succeeds erc20 -> weth', async () => {
      const quotePost: QuoteBody = {
        tokenIn: 'USDT',
        tokenOut: 'WETH',
        amount: '100',
        type,
        chainId: 1,
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

    test('succeeds erc20 -> erc20 by address', async () => {
      const quotePost: QuoteBody = {
        tokenIn: '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI
        tokenOut: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
        amount: '100',
        type,
        chainId: 1,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        algorithm,
      };

      const response: AxiosResponse<QuoteResponse> = await axios.post<QuoteResponse>(
        API,
        quotePost
      );

      const {
        data: { quote, quoteGasAdjusted },
        status,
      } = response;

      expect(status).toBe(200);
      expect(parseFloat(quote)).toBeGreaterThan(90);

      if (type == 'exactIn') {
        expect(parseFloat(quoteGasAdjusted)).toBeLessThanOrEqual(
          parseFloat(quote)
        );
      } else {
        expect(parseFloat(quoteGasAdjusted)).toBeGreaterThanOrEqual(
          parseFloat(quote)
        );
      }

      expect(parseFloat(quote)).toBeLessThan(110);
    });

    test('succeeds erc20 -> erc20 one by address one by symbol', async () => {
      const quotePost: QuoteBody = {
        tokenIn: '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI
        tokenOut: 'USDC',
        amount: '100',
        type,
        chainId: 1,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        algorithm,
      };

      const response: AxiosResponse<QuoteResponse> = await axios.post<QuoteResponse>(
        API,
        quotePost
      );
      const {
        data: { quote, quoteGasAdjusted },
        status,
      } = response;

      expect(status).toBe(200);
      expect(parseFloat(quote)).toBeGreaterThan(90);

      if (type == 'exactIn') {
        expect(parseFloat(quoteGasAdjusted)).toBeLessThanOrEqual(
          parseFloat(quote)
        );
      } else {
        expect(parseFloat(quoteGasAdjusted)).toBeGreaterThanOrEqual(
          parseFloat(quote)
        );
      }

      expect(parseFloat(quote)).toBeLessThan(110);
    });

    test('succeeds for input token permit with amount and deadline', async () => {
      const quotePost: QuoteBody = {
        tokenIn: 'USDC',
        tokenOut: 'USDT',
        amount: '100',
        type,
        chainId: 1,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        algorithm,
        inputTokenPermit: {
          v: 27,
          r: '0x223a7c9bcf5531c99be5ea7082183816eb20cfe0bbc322e97cc5c7f71ab8b20e',
          s: '0x2aadee6b34b45bb15bc42d9c09de4a6754e7000908da72d48cc7704971491663',
          amount: '100',
          deadline: '60',
        },
      };

      const response: AxiosResponse<QuoteResponse> = await axios.post<QuoteResponse>(
        API,
        quotePost
      );
      const {
        data: { quote, quoteGasAdjusted },
        status,
      } = response;

      expect(status).toBe(200);
      expect(parseFloat(quote)).toBeGreaterThan(90);

      if (type == 'exactIn') {
        expect(parseFloat(quoteGasAdjusted)).toBeLessThanOrEqual(
          parseFloat(quote)
        );
      } else {
        expect(parseFloat(quoteGasAdjusted)).toBeGreaterThanOrEqual(
          parseFloat(quote)
        );
      }

      expect(parseFloat(quote)).toBeLessThan(110);
    });

    test('succeeds for input token permit with nonce and expiry', async () => {
      const quotePost: QuoteBody = {
        tokenIn: 'USDC',
        tokenOut: 'USDT',
        amount: '100',
        type,
        chainId: 1,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        algorithm,
        inputTokenPermit: {
          v: 27,
          r: '0x223a7c9bcf5531c99be5ea7082183816eb20cfe0bbc322e97cc5c7f71ab8b20e',
          s: '0x2aadee6b34b45bb15bc42d9c09de4a6754e7000908da72d48cc7704971491663',
          nonce: '101',
          expiry: '60',
        },
      };

      const response: AxiosResponse<QuoteResponse> = await axios.post<QuoteResponse>(
        API,
        quotePost
      );
      const {
        data: { quote, quoteGasAdjusted },
        status,
      } = response;

      expect(status).toBe(200);
      expect(parseFloat(quote)).toBeGreaterThan(90);

      if (type == 'exactIn') {
        expect(parseFloat(quoteGasAdjusted)).toBeLessThanOrEqual(
          parseFloat(quote)
        );
      } else {
        expect(parseFloat(quoteGasAdjusted)).toBeGreaterThanOrEqual(
          parseFloat(quote)
        );
      }

      expect(parseFloat(quote)).toBeLessThan(110);
    });
  });

  describe.each([['exactIn'], ['exactOut']])('4xx %s', (type: string) => {
    test('fails if field is missing in body', async () => {
      const quotePost: Partial<QuoteBody> = {
        tokenOut: 'USDT',
        amount: '100',
        type,
        chainId: 1,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        algorithm,
      };

      await expect(axios.post<QuoteResponse>(API, quotePost)).rejects.toMatchObject({
        response: {
          status: 400,
          data: {
            detail: '"tokenIn" is required',
            errorCode: 'VALIDATION_ERROR',
          },
        },
      });
    });

    test('fails if amount is negative', async () => {
      const quotePost: Partial<QuoteBody> = {
        tokenIn: 'USDC',
        tokenOut: 'USDT',
        amount: '-100',
        type,
        chainId: 1,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        algorithm,
      };

      await expect(axios.post<QuoteResponse>(API, quotePost)).rejects.toMatchObject({
        response: {
          status: 400,
          data: {
            detail:
              '"amount" with value "-100" fails to match the required pattern: /^[+]?([.]\\d+|\\d+([.]\\d+)?)$/',
            errorCode: 'VALIDATION_ERROR',
          },
        },
      });
    });

    test('fails if amount is too big', async () => {
      const quotePost: Partial<QuoteBody> = {
        tokenIn: 'USDC',
        tokenOut: 'USDT',
        amount: '10000000000000000000000000000000',
        type,
        chainId: 1,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        algorithm,
      };

      await expect(axios.post<QuoteResponse>(API, quotePost)).rejects.toMatchObject({
        response: {
          status: 400,
          data: {
            detail:
              '"amount" length must be less than or equal to 20 characters long',
            errorCode: 'VALIDATION_ERROR',
          },
        },
      });
    });

    test('fails if symbol doesnt exist', async () => {
      const quotePost: Partial<QuoteBody> = {
        tokenIn: 'USDC',
        tokenOut: 'NONEXISTANTTOKEN',
        amount: '100',
        type,
        chainId: 1,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        algorithm,
      };

      await expect(axios.post<QuoteResponse>(API, quotePost)).rejects.toMatchObject({
        response: {
          status: 400,
          data: {
            detail: 'Could not find token NONEXISTANTTOKEN',
            errorCode: 'TOKEN_OUT_INVALID',
          },
        },
      });
    });

    test('fails if tokens are the same symbol', async () => {
      const quotePost: Partial<QuoteBody> = {
        tokenIn: 'USDT',
        tokenOut: 'USDT',
        amount: '100',
        type,
        chainId: 1,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        algorithm,
      };

      await expect(axios.post<QuoteResponse>(API, quotePost)).rejects.toMatchObject({
        response: {
          status: 400,
          data: {
            detail: 'tokenIn and tokenOut must be different',
            errorCode: 'TOKEN_IN_OUT_SAME',
          },
        },
      });
    });

    test('fails if tokens are the same address', async () => {
      const quotePost: Partial<QuoteBody> = {
        tokenIn: 'USDT',
        tokenOut: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        amount: '100',
        type,
        chainId: 1,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        algorithm,
      };

      await expect(axios.post<QuoteResponse>(API, quotePost)).rejects.toMatchObject({
        response: {
          status: 400,
          data: {
            detail: 'tokenIn and tokenOut must be different',
            errorCode: 'TOKEN_IN_OUT_SAME',
          },
        },
      });
    });

    test('fails if recipient is an invalid address', async () => {
      const quotePost: Partial<QuoteBody> = {
        tokenIn: 'USDT',
        tokenOut: 'USDC',
        amount: '100',
        type,
        chainId: 1,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aZZZZZZZ',
        slippageTolerance: '5',
        deadline: '360',
        algorithm,
      };

      await expect(axios.post<QuoteResponse>(API, quotePost)).rejects.toMatchObject({
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
