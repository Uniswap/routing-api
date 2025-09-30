import { Request, Response } from 'express';
import { handleQuote } from '../handleQuote';
import { handleSwaps } from '../handleSwaps';

// Helper to convert Express handlers to GraphQL resolvers
const createMockResponse = (): { res: Response; getResponse: () => Promise<any> } => {
  let responseData: any = null;
  let statusCode = 200;
  let resolver: (value: any) => void;
  const responsePromise = new Promise((resolve) => {
    resolver = resolve;
  });

  const res = {
    status: (code: number) => {
      statusCode = code;
      return res;
    },
    json: (data: any) => {
      responseData = data;
      resolver(data);
      return res;
    },
    send: (data: any) => {
      if (typeof data === 'string') {
        try {
          responseData = JSON.parse(data);
        } catch {
          responseData = data;
        }
      } else {
        responseData = data;
      }
      resolver(responseData);
      return res;
    },
    setHeader: () => res,
  } as unknown as Response;

  const getResponse = async () => {
    await responsePromise;

    if (statusCode >= 400) {
      throw new Error(responseData?.message || responseData?.detail || 'Request failed');
    }

    return responseData;
  };

  return { res, getResponse };
};

export const resolvers = {
  Query: {
    health: () => 'ok',

    swaps: async (_: any, { txHashes, chainId }: { txHashes: string[]; chainId: number }) => {
      const { res, getResponse } = createMockResponse();

      const req = {
        query: {
          txHashes: txHashes.join(','),
          chainId: chainId.toString(),
        },
      } as unknown as Request;

      await handleSwaps(req, res);

      return await getResponse();
    },

    quote: async (_: any, { input }: { input: any }) => {
      const { res, getResponse } = createMockResponse();

      const req = {
        body: {
          tokenInAddress: input.tokenInAddress,
          tokenInChainId: input.tokenInChainId,
          tokenOutAddress: input.tokenOutAddress,
          tokenOutChainId: input.tokenOutChainId,
          amount: input.amount,
          type: input.type,
          swapper: input.swapper,
          slippageTolerance: input.slippageTolerance,
          deadline: input.deadline,
        },
        headers: {},
      } as unknown as Request;

      await handleQuote(req, res);

      return await getResponse();
    },
  },
};