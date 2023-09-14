import {
  CachingTokenListProvider,
  ITokenListProvider,
  ITokenProvider,
  log,
  NodeJSCache,
} from '@uniswap/smart-order-router'
import { ChainId } from '@uniswap/sdk-core'
import { TokenList } from '@uniswap/token-lists'
import S3 from 'aws-sdk/clients/s3'
import NodeCache from 'node-cache'

const TOKEN_LIST_CACHE = new NodeCache({ stdTTL: 600, useClones: false })

export class AWSTokenListProvider extends CachingTokenListProvider {
  public static async fromTokenListS3Bucket(
    chainId: ChainId,
    bucket: string,
    tokenListURI: string
  ): Promise<ITokenListProvider & ITokenProvider> {
    const s3 = new S3({ correctClockSkew: true, maxRetries: 3 })

    const cachedTokenList = TOKEN_LIST_CACHE.get<TokenList>(tokenListURI)

    const tokenCache = new NodeCache({ stdTTL: 360, useClones: false })

    if (cachedTokenList) {
      log.info(`Found token lists for ${tokenListURI} in local cache`)
      return super.fromTokenList(chainId, cachedTokenList, new NodeJSCache(tokenCache))
    }

    try {
      log.info(`Getting tokenLists from s3.`)
      const tokenListResult = await s3.getObject({ Key: encodeURIComponent(tokenListURI), Bucket: bucket }).promise()

      const { Body: tokenListBuffer } = tokenListResult

      if (!tokenListBuffer) {
        return super.fromTokenListURI(chainId, tokenListURI, new NodeJSCache(tokenCache))
      }

      const tokenList = JSON.parse(tokenListBuffer.toString('utf-8')) as TokenList

      log.info(`Got both tokenLists from s3. ${tokenList.tokens.length} tokens in main list.`)

      TOKEN_LIST_CACHE.set<TokenList>(tokenListURI, tokenList)

      return new CachingTokenListProvider(chainId, tokenList, new NodeJSCache(tokenCache))
    } catch (err) {
      log.info({ err }, `Failed to get tokenLists from s3.`)
      return super.fromTokenListURI(chainId, tokenListURI, new NodeJSCache(tokenCache))
    }
  }
}
