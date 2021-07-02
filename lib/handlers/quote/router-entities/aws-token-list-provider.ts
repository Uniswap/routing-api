import {
  ITokenListProvider,
  log,
  TokenListProvider,
} from '@uniswap/smart-order-router';
import { TokenList } from '@uniswap/token-lists';
import S3 from 'aws-sdk/clients/s3';
import NodeCache from 'node-cache';

const TOKEN_LIST_CACHE = new NodeCache({ stdTTL: 600, useClones: false });

export class AWSTokenListProvider extends TokenListProvider {
  public static async fromTokenListS3Bucket(
    bucket: string,
    tokenListURI: string,
    blockTokenListURI: string
  ): Promise<ITokenListProvider> {
    const s3 = new S3();

    const cachedTokenList = TOKEN_LIST_CACHE.get<TokenList>(tokenListURI);
    const cachedBlockList = TOKEN_LIST_CACHE.get<TokenList>(blockTokenListURI);

    if (cachedTokenList && cachedBlockList) {
      log.info(
        `Found token lists for ${tokenListURI} and ${blockTokenListURI} in local cache`
      );
      return super.fromTokenList(cachedTokenList, cachedBlockList);
    }

    try {
      log.info(`Getting tokenLists from s3.`);
      const [tokenListResult, blockListResult] = await Promise.all([
        s3
          .getObject({ Key: encodeURIComponent(tokenListURI), Bucket: bucket })
          .promise(),
        s3
          .getObject({
            Key: encodeURIComponent(blockTokenListURI),
            Bucket: bucket,
          })
          .promise(),
      ]);

      const { Body: tokenListBuffer } = tokenListResult;
      const { Body: blockListBuffer } = blockListResult;

      if (!tokenListBuffer || !blockListBuffer) {
        return super.fromTokenListURI(tokenListURI, blockTokenListURI);
      }

      const tokenList = JSON.parse(
        tokenListBuffer.toString('utf-8')
      ) as TokenList;

      const blockTokenList = JSON.parse(
        blockListBuffer.toString('utf-8')
      ) as TokenList;

      log.info(
        `Got both tokenLists from s3. ${tokenList.tokens.length} tokens in main list. ${blockTokenList.tokens.length} in block list`
      );

      TOKEN_LIST_CACHE.set<TokenList>(tokenListURI, tokenList);
      TOKEN_LIST_CACHE.set<TokenList>(blockTokenListURI, blockTokenList);

      return new TokenListProvider(tokenList, blockTokenList);
    } catch (err) {
      log.info({ err }, `Failed to get tokenLists from s3.`);
      return super.fromTokenListURI(tokenListURI, blockTokenListURI);
    }
  }
}
