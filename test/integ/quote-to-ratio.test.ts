import DEFAULT_TOKEN_LIST from '@uniswap/default-token-list';
import { Currency, Ether, Fraction } from '@uniswap/sdk-core';
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
import { FeeAmount, getMinTick, getMaxTick, TICK_SPACINGS } from '../utils/ticks';
import { absoluteValue } from '../utils/absoluteValue';

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
  const decimals = (await tokenStringToCurrency(tokenAddress))?.decimals;
  return parseUnits(value.toString(), decimals).toString();
}

async function tokenStringToCurrency(tokenString: string): Promise<Currency | undefined> {
  const isAddress = (s: string) => s.length == 42 && s.startsWith('0x');

  let token: Currency | undefined
  if (
    tokenString == 'ETH' ||
    tokenString.toLowerCase() == '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
  ) {
    token = Ether.onChain(1);
  } else if (isAddress(tokenString)) {
    token = await tokenListProvider.getTokenByAddress(tokenString);
  }

  if (!token) {
    token = await tokenListProvider.getTokenBySymbol(tokenString);
  }

  if (!token) {
    throw new Error('could not find token')
  }

  return token;

}

function parseFraction(fraction: ResponseFraction): Fraction {
  return new Fraction(JSBI.BigInt(fraction.numerator), JSBI.BigInt(fraction.denominator))
}

describe('quote-to-ratio', () => {
  let token0Address: string;
  let token1Address: string;
  let token0Balance: string;
  let token1Balance: string;
  let errorTolerance: number;
  let errorToleranceFraction: Fraction;

  beforeEach(async () => {
    token0Address = '0xdac17f958d2ee523a2206206994597c13d831ec7';
    token1Address = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
    token0Balance = await parseAmount(5_000, token0Address);
    token1Balance = await parseAmount(2_000, token1Address);
    errorTolerance = 1
    errorToleranceFraction = new Fraction(errorTolerance * 100, 10_000)
  });

  test('erc20 -> erc20 low volume trade token0Excess', async () => {
    const quoteToRatioRec: QuoteToRatioQueryParams = {
      token0Address,
      token0ChainId: 1,
      token1Address,
      token1ChainId: 1,
      token0Balance,
      token1Balance,
      tickLower: -60,
      tickUpper: 60,
      feeAmount: 500,
      recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
      slippageTolerance: '5',
      deadline: '360',
      errorTolerance,
      maxIterations: 6,
    };

    const queryParams = qs.stringify(quoteToRatioRec);
    const response: AxiosResponse<QuoteToRatioResponse> =
      await axios.get<QuoteToRatioResponse>(`${API}?${queryParams}`);
    const {
      data: {
        tokenInAddress,
        tokenOutAddress,
        newRatioFraction,
        optimalRatioFraction,
      },
      status,
    } = response;

    const newRatio = parseFraction(newRatioFraction)
    const optimalRatio =  parseFraction(optimalRatioFraction)
    const ratioDeviation = absoluteValue(new Fraction(1, 1).subtract(newRatio.divide(optimalRatio)))

    expect(status).toBe(200);
    expect(ratioDeviation.lessThan(errorToleranceFraction)).toBe(true)
    expect(tokenInAddress.toLowerCase()).toEqual(token0Address.toLowerCase())
    expect(tokenOutAddress.toLowerCase()).toEqual(token1Address.toLowerCase())
  });

  test('erc20 -> erc20 high volume trade token0Excess', async () => {
    token0Balance = await parseAmount(100_000_000, token0Address);
    token1Balance = await parseAmount(2_000, token1Address);
    const quoteToRatioRec: QuoteToRatioQueryParams = {
      token0Address,
      token0ChainId: 1,
      token1Address,
      token1ChainId: 1,
      token0Balance,
      token1Balance,
      tickLower: -200,
      tickUpper: 200,
      feeAmount: 10000,
      recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
      slippageTolerance: '5',
      deadline: '360',
      errorTolerance,
      maxIterations: 6,
    };

    const queryParams = qs.stringify(quoteToRatioRec);
    const response: AxiosResponse<QuoteToRatioResponse> =
      await axios.get<QuoteToRatioResponse>(`${API}?${queryParams}`);
    const {
      data: {
        tokenInAddress,
        tokenOutAddress,
        newRatioFraction,
        optimalRatioFraction,
      },
      status,
    } = response;

    const newRatio = parseFraction(newRatioFraction)
    const optimalRatio =  parseFraction(optimalRatioFraction)
    const ratioDeviation = absoluteValue(new Fraction(1, 1).subtract(newRatio.divide(optimalRatio)))

    expect(status).toBe(200);
    expect(ratioDeviation.lessThan(errorToleranceFraction)).toBe(true)
    expect(tokenInAddress.toLowerCase()).toEqual(token0Address.toLowerCase())
    expect(tokenOutAddress.toLowerCase()).toEqual(token1Address.toLowerCase())
  });

  test('erc20 -> erc20 low volume trade token1Excess', async () => {
    token0Balance = await parseAmount(2_000, token0Address);
    token1Balance = await parseAmount(5_000, token1Address);
    const quoteToRatioRec: QuoteToRatioQueryParams = {
      token0Address,
      token0ChainId: 1,
      token1Address,
      token1ChainId: 1,
      token0Balance,
      token1Balance,
      tickLower: -180,
      tickUpper: 180,
      feeAmount: 500,
      recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
      slippageTolerance: '5',
      deadline: '360',
      errorTolerance,
      maxIterations: 6,
    };

    const queryParams = qs.stringify(quoteToRatioRec);
    const response: AxiosResponse<QuoteToRatioResponse> =
      await axios.get<QuoteToRatioResponse>(`${API}?${queryParams}`);
    const {
      data: {
        tokenInAddress,
        tokenOutAddress,
        newRatioFraction,
        optimalRatioFraction,
      },
      status,
    } = response;

    const newRatio = parseFraction(newRatioFraction)
    const optimalRatio =  parseFraction(optimalRatioFraction)
    const ratioDeviation = absoluteValue(new Fraction(1, 1).subtract(newRatio.divide(optimalRatio)))

    expect(status).toBe(200);
    expect(ratioDeviation.lessThan(errorToleranceFraction)).toBe(true)
    expect(tokenInAddress.toLowerCase()).toEqual(token1Address.toLowerCase())
    expect(tokenOutAddress.toLowerCase()).toEqual(token0Address.toLowerCase())
  });

  test('erc20 -> erc20 high volume trade token1Excess', async () => {
    token0Balance = await parseAmount(2_000, token0Address);
    token1Balance = await parseAmount(100_000_000, token1Address);
    const quoteToRatioRec: QuoteToRatioQueryParams = {
      token0Address,
      token0ChainId: 1,
      token1Address,
      token1ChainId: 1,
      token0Balance,
      token1Balance,
      tickLower: -200,
      tickUpper: 200,
      feeAmount: 10000,
      recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
      slippageTolerance: '5',
      deadline: '360',
      errorTolerance,
      maxIterations: 6,
    };

    const queryParams = qs.stringify(quoteToRatioRec);
    const response: AxiosResponse<QuoteToRatioResponse> =
      await axios.get<QuoteToRatioResponse>(`${API}?${queryParams}`);
    const {
      data: {
        tokenInAddress,
        tokenOutAddress,
        newRatioFraction,
        optimalRatioFraction,
      },
      status,
    } = response;

    const newRatio = parseFraction(newRatioFraction)
    const optimalRatio =  parseFraction(optimalRatioFraction)
    const ratioDeviation = absoluteValue(new Fraction(1, 1).subtract(newRatio.divide(optimalRatio)))

    expect(status).toBe(200);
    expect(ratioDeviation.lessThan(errorToleranceFraction)).toBe(true)
    expect(tokenInAddress.toLowerCase()).toEqual(token1Address.toLowerCase())
    expect(tokenOutAddress.toLowerCase()).toEqual(token0Address.toLowerCase())
  });

  test('erc20 -> erc20 range order position token0 excess', async () => {
    token0Balance = await parseAmount(50_000, token0Address);
    token1Balance = await parseAmount(2_000, token1Address);
    const quoteToRatioRec: QuoteToRatioQueryParams = {
      token0Address,
      token0ChainId: 1,
      token1Address,
      token1ChainId: 1,
      token0Balance,
      token1Balance,
      tickLower: 100_000,
      tickUpper: 200_000,
      feeAmount: 500,
      recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
      slippageTolerance: '5',
      deadline: '360',
      errorTolerance,
      maxIterations: 6,
    };

    const queryParams = qs.stringify(quoteToRatioRec);
    const response: AxiosResponse<QuoteToRatioResponse> =
      await axios.get<QuoteToRatioResponse>(`${API}?${queryParams}`);
    const {
      data: {
        amount,
        newRatioFraction,
        optimalRatioFraction,
      },
      status,
    } = response;

    const newRatio = parseFraction(newRatioFraction)
    const optimalRatio =  parseFraction(optimalRatioFraction)
    const ratioDeviation = absoluteValue(new Fraction(1, 1).subtract(newRatio.divide(optimalRatio)))

    expect(status).toBe(200);
    expect(!ratioDeviation.greaterThan(errorToleranceFraction)).toBe(true)
    expect(amount).toEqual(token0Balance)
  });

  test('erc20 -> erc20 range order position token1 excess', async () => {
    token0Balance = await parseAmount(50_000, token0Address);
    token1Balance = await parseAmount(2_000, token1Address);
    const quoteToRatioRec: QuoteToRatioQueryParams = {
      token0Address,
      token0ChainId: 1,
      token1Address,
      token1ChainId: 1,
      token0Balance,
      token1Balance,
      tickLower: -200_000,
      tickUpper: -100_000,
      feeAmount: 500,
      recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
      slippageTolerance: '5',
      deadline: '360',
      errorTolerance,
      maxIterations: 6,
    };

    const queryParams = qs.stringify(quoteToRatioRec);
    const response: AxiosResponse<QuoteToRatioResponse> =
      await axios.get<QuoteToRatioResponse>(`${API}?${queryParams}`);
    const {
      data: {
        amount,
        newRatioFraction,
        optimalRatioFraction,
      },
      status,
    } = response;

    const newRatio = parseFraction(newRatioFraction)
    const optimalRatio =  parseFraction(optimalRatioFraction)
    const ratioDeviation = absoluteValue(new Fraction(1, 1).subtract(newRatio.divide(optimalRatio)))

    expect(status).toBe(200);
    expect(ratioDeviation).toEqual(new Fraction(0, 0))
    expect(amount).toEqual(token1Balance)
  });

  test('weth -> erc20', async () => {
    token0Address = 'WETH'
    token1Address = 'DAI'
    token0Balance = await parseAmount(5_000, token0Address);
    token1Balance = await parseAmount(2_000, token1Address);
    const quoteToRatioRec: QuoteToRatioQueryParams = {
      token0Address,
      token0ChainId: 1,
      token1Address,
      token1ChainId: 1,
      token0Balance,
      token1Balance,
      tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
      tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
      feeAmount: FeeAmount.MEDIUM,
      recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
      slippageTolerance: '5',
      deadline: '360',
      errorTolerance,
      maxIterations: 6,
    };

    const queryParams = qs.stringify(quoteToRatioRec);
    const response: AxiosResponse<QuoteToRatioResponse> =
      await axios.get<QuoteToRatioResponse>(`${API}?${queryParams}`);
    const {
      data: {
        newRatioFraction,
        optimalRatioFraction,
      },
      status,
    } = response;

    const newRatio = parseFraction(newRatioFraction)
    const optimalRatio =  parseFraction(optimalRatioFraction)
    const ratioDeviation = absoluteValue(new Fraction(1, 1).subtract(newRatio.divide(optimalRatio)))

    expect(status).toBe(200);
    expect(!ratioDeviation.greaterThan(errorToleranceFraction)).toBe(true)
  });

  test('erc20 -> weth', async () => {
    token0Address = 'WETH'
    token1Address = 'DAI'
    token0Balance = await parseAmount(0, token0Address);
    token1Balance = await parseAmount(20_000, token1Address);
    const quoteToRatioRec: QuoteToRatioQueryParams = {
      token0Address,
      token0ChainId: 1,
      token1Address,
      token1ChainId: 1,
      token0Balance,
      token1Balance,
      tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
      tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
      feeAmount: FeeAmount.MEDIUM,
      recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
      slippageTolerance: '5',
      deadline: '360',
      errorTolerance,
      maxIterations: 6,
    };

    const queryParams = qs.stringify(quoteToRatioRec);
    const response: AxiosResponse<QuoteToRatioResponse> =
      await axios.get<QuoteToRatioResponse>(`${API}?${queryParams}`);
    const {
      data: {
        newRatioFraction,
        optimalRatioFraction,
      },
      status,
    } = response;

    const newRatio = parseFraction(newRatioFraction)
    const optimalRatio =  parseFraction(optimalRatioFraction)
    const ratioDeviation = absoluteValue(new Fraction(1, 1).subtract(newRatio.divide(optimalRatio)))

    expect(status).toBe(200);
    expect(!ratioDeviation.greaterThan(errorToleranceFraction)).toBe(true)
  });

  describe('4xx Error response',  () => {
    test('when both balances are 0', async () => {
      token0Address = 'WETH'
      token1Address = 'DAI'
      token0Balance = await parseAmount(0, token0Address);
      token1Balance = await parseAmount(0, token1Address);
      const quoteToRatioRec: QuoteToRatioQueryParams = {
        token0Address,
        token0ChainId: 1,
        token1Address,
        token1ChainId: 1,
        token0Balance,
        token1Balance,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        feeAmount: FeeAmount.MEDIUM,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        errorTolerance,
        maxIterations: 6,
      };

      const queryParams = qs.stringify(quoteToRatioRec);

      await expect(
        axios.get<QuoteToRatioResponse>(`${API}?${queryParams}`)
      ).rejects.toMatchObject({
        response: {
          status: 404,
          data: {
            detail: 'No route found',
            errorCode: 'NO_ROUTE',
          },
        },
      });
    })

    test('when both balances are 0', async () => {
      token0Address = 'WETH'
      token1Address = 'DAI'
      token0Balance = await parseAmount(0, token0Address);
      token1Balance = await parseAmount(0, token1Address);
      const quoteToRatioRec: QuoteToRatioQueryParams = {
        token0Address,
        token0ChainId: 1,
        token1Address,
        token1ChainId: 1,
        token0Balance,
        token1Balance,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        feeAmount: FeeAmount.MEDIUM,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        errorTolerance,
        maxIterations: 6,
      };

      const queryParams = qs.stringify(quoteToRatioRec);

      await expect(
        axios.get<QuoteToRatioResponse>(`${API}?${queryParams}`)
      ).rejects.toMatchObject({
        response: {
          status: 404,
          data: {
            detail: 'No route found',
            errorCode: 'NO_ROUTE',
          },
        },
      });
    })

    test('when max iterations is 0', async () => {
      token0Address = 'WETH'
      token1Address = 'DAI'
      token0Balance = await parseAmount(50_000, token0Address);
      token1Balance = await parseAmount(2_000, token1Address);
      const quoteToRatioRec: QuoteToRatioQueryParams = {
        token0Address,
        token0ChainId: 1,
        token1Address,
        token1ChainId: 1,
        token0Balance,
        token1Balance,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        feeAmount: FeeAmount.MEDIUM,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        errorTolerance,
        maxIterations: 0,
      };

      const queryParams = qs.stringify(quoteToRatioRec);

      await expect(
        axios.get<QuoteToRatioResponse>(`${API}?${queryParams}`)
      ).rejects.toMatchObject({
        response: {
          status: 400,
          data: {
            detail: '"maxIterations" must be larger than or equal to 1',
            errorCode: 'VALIDATION_ERROR',
          },
        },
      });
    })

    test('when ratio is already fulfilled', async () => {
      token0Balance = await parseAmount(2_000, token0Address);
      token1Balance = await parseAmount(0, token1Address);
      const quoteToRatioRec: QuoteToRatioQueryParams = {
        token0Address,
        token0ChainId: 1,
        token1Address,
        token1ChainId: 1,
        token0Balance,
        token1Balance,
        tickLower: -120,
        tickUpper: -60,
        feeAmount: 500,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        errorTolerance,
        maxIterations: 6,
      };

      const queryParams = qs.stringify(quoteToRatioRec);

      await expect(
        axios.get<QuoteToRatioResponse>(`${API}?${queryParams}`)
      ).rejects.toMatchObject({
        response: {
          status: 404,
          data: {
            detail: 'No route found',
            errorCode: 'NO_ROUTE',
          },
        },
      });
    })
  })

  test('amount exceeds uint256', async () => {
    token0Address = 'WETH'
    token1Address = 'DAI'
    token0Balance = '100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'
    token1Balance = await parseAmount(2_000, token1Address);
    const quoteToRatioRec: QuoteToRatioQueryParams = {
      token0Address,
      token0ChainId: 1,
      token1Address,
      token1ChainId: 1,
      token0Balance,
      token1Balance,
      tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
      tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
      feeAmount: FeeAmount.MEDIUM,
      recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
      slippageTolerance: '5',
      deadline: '360',
      errorTolerance,
      maxIterations: 5,
    };

    const queryParams = qs.stringify(quoteToRatioRec);

    await expect(
      axios.get<QuoteToRatioResponse>(`${API}?${queryParams}`)
    ).rejects.toMatchObject({
      response: {
        status: 400,
        data: {
          detail: '"token0Balance" length must be less than or equal to 77 characters long',
          errorCode: 'VALIDATION_ERROR',
        },
      },
    });
  })

  test('with unknown token', async () => {
    token0Address = 'UNKNOWNTOKEN'
    token1Address = 'DAI'
    token0Balance = '2000000000000'
    token1Balance = await parseAmount(2_000, token1Address);
    const quoteToRatioRec: QuoteToRatioQueryParams = {
      token0Address,
      token0ChainId: 1,
      token1Address,
      token1ChainId: 1,
      token0Balance,
      token1Balance,
      tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
      tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
      feeAmount: FeeAmount.MEDIUM,
      recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
      slippageTolerance: '5',
      deadline: '360',
      errorTolerance,
      maxIterations: 5,
    };

    const queryParams = qs.stringify(quoteToRatioRec);

    await expect(
      axios.get<QuoteToRatioResponse>(`${API}?${queryParams}`)
    ).rejects.toMatchObject({
      response: {
        status: 400,
        data: {
          detail: 'Could not find token with address "UNKNOWNTOKEN"',
          errorCode: 'TOKEN_0_INVALID',
        },
      },
    });
  })

  test('when tokens are the same', async () => {
    token0Address = 'DAI'
    token1Address = 'DAI'
    token0Balance = '2000000000000'
    token1Balance = await parseAmount(2_000, token1Address);
    const quoteToRatioRec: QuoteToRatioQueryParams = {
      token0Address,
      token0ChainId: 1,
      token1Address,
      token1ChainId: 1,
      token0Balance,
      token1Balance,
      tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
      tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
      feeAmount: FeeAmount.MEDIUM,
      recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
      slippageTolerance: '5',
      deadline: '360',
      errorTolerance,
      maxIterations: 5,
    };

    const queryParams = qs.stringify(quoteToRatioRec);

    await expect(
      axios.get<QuoteToRatioResponse>(`${API}?${queryParams}`)
    ).rejects.toMatchObject({
      response: {
        status: 400,
        data: {
          detail: 'token0 and token1 must be different',
          errorCode: 'TOKEN_0_1_SAME',
        },
      },
    });
  })
});
