import axios from 'axios';
import { QuoteBody } from '../../lib/schema/quote';

const API = `${process.env.UNISWAP_ROUTING_API!}quote`;

describe('exactIn', () => {
  test('succeeds', async () => {
    const quotePost: QuoteBody = {
      tokenIn: 'USDC',
      tokenOut: 'USDT',
      amount: '100',
      type: 'exactIn',
      chainId: 1,
      recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
      slippageTolerance: '5',
      deadline: '360',
      algorithm: 'exactIn',
    };

    const response = await axios.post<any>(API, quotePost);
    const { data, status } = response;

    expect(status).toBe(200);
    expect(parseFloat(data.rawQuote)).toBeGreaterThan(90);
    expect(parseFloat(data.rawQuote)).toBeLessThan(110);
  });

  test('fails with invalid body', async () => {
    const quotePost: Partial<QuoteBody> = {
      tokenOut: 'USDT',
      amount: '100',
      type: 'exactIn',
      chainId: 1,
      recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
      slippageTolerance: '5',
      deadline: '360',
      algorithm: 'exactIn',
    };

    await expect(axios.post<any>(API, quotePost)).rejects.toMatchObject({
      response: {
        status: 400,
        data: '"tokenIn" is required',
      },
    });
  });
});
