import axios from 'axios';
import { QuoteBody } from '../../lib/handlers/quote/schema/quote';

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

      const response = await axios.post<any>(API, quotePost);
      const { data, status } = response;

      expect(status).toBe(200);
      expect(parseFloat(data.rawQuote)).toBeGreaterThan(90);
      expect(parseFloat(data.rawQuote)).toBeLessThan(110);
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

      const response = await axios.post<any>(API, quotePost);
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

      const response = await axios.post<any>(API, quotePost);
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

      const response = await axios.post<any>(API, quotePost);
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

      const response = await axios.post<any>(API, quotePost);
      const { data, status } = response;

      expect(status).toBe(200);
      expect(data.methodParameters).toBeDefined();
    });
  });

  describe('4xx', () => {
    test('fails with invalid body', async () => {
      const quotePost: Partial<QuoteBody> = {
        tokenOut: 'USDT',
        amount: '100',
        type: 'exactIn',
        chainId: 1,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        algorithm,
      };

      await expect(axios.post<any>(API, quotePost)).rejects.toMatchObject({
        response: {
          status: 400,
          data: '"tokenIn" is required',
        },
      });
    });
  });
});
