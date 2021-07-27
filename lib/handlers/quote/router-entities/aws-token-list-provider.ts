import {
  ChainId,
  ITokenListProvider,
  ITokenProvider,
  log,
  TokenListProvider,
} from '@uniswap/smart-order-router';
import { TokenList } from '@uniswap/token-lists';
import S3 from 'aws-sdk/clients/s3';
import NodeCache from 'node-cache';

const TOKEN_LIST_CACHE = new NodeCache({ stdTTL: 600, useClones: false });

export class AWSTokenListProvider extends TokenListProvider {
  public static async fromTokenListS3Bucket(
    chainId: ChainId,
    bucket: string,
    tokenListURI: string
  ): Promise<ITokenListProvider & ITokenProvider> {
    const s3 = new S3();

    const cachedTokenList = TOKEN_LIST_CACHE.get<TokenList>(tokenListURI);

    if (cachedTokenList) {
      log.info(`Found token lists for ${tokenListURI} in local cache`);
      return super.fromTokenList(chainId, cachedTokenList);
    }

    try {
      log.info(`Getting tokenLists from s3.`);
      const tokenListResult = await s3
        .getObject({ Key: encodeURIComponent(tokenListURI), Bucket: bucket })
        .promise();

      const { Body: tokenListBuffer } = tokenListResult;

      if (!tokenListBuffer) {
        return super.fromTokenListURI(chainId, tokenListURI);
      }

      const tokenList = JSON.parse(
        tokenListBuffer.toString('utf-8')
      ) as TokenList;

      log.info(
        `Got both tokenLists from s3. ${tokenList.tokens.length} tokens in main list.`
      );

      TOKEN_LIST_CACHE.set<TokenList>(tokenListURI, tokenList);

      return new TokenListProvider(chainId, tokenList);
    } catch (err) {
      log.info({ err }, `Failed to get tokenLists from s3.`);
      return super.fromTokenListURI(chainId, tokenListURI);
    }
  }
}
