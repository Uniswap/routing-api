import { CachedRoutes, CacheMode, ChainId, IRouteCachingProvider, log } from '@uniswap/smart-order-router'
import { DynamoDB } from 'aws-sdk'
import { Currency, CurrencyAmount, Token, TradeType } from '@uniswap/sdk-core'
import { Protocol } from '@uniswap/router-sdk'
import { CACHED_ROUTES_CONFIGURATION } from './cached-routes-configuration'
import { PairTradeTypeChainId } from './model/pair-trade-type-chain-id'
import { CachedRoutesMarshaller } from './marshalling/cached-routes-marshaller'
import { CachedRoutesStrategy } from './model/cached-routes-strategy'

export class DynamoRouteCachingProvider extends IRouteCachingProvider {
  private ddbClient: DynamoDB.DocumentClient
  private tableName: string

  constructor(cachedRoutesTableName: string) {
    super()
    this.ddbClient = new DynamoDB.DocumentClient()
    this.tableName = cachedRoutesTableName
  }

  protected _getBlocksToLive(cachedRoutes: CachedRoutes, amount: CurrencyAmount<Currency>): Promise<number> {
    const cachedRoutesStrategy = this.getCachedRoutesStrategyFromCachedRoutes(cachedRoutes)
    const cachingParameters = cachedRoutesStrategy?.getCachingParameters(amount)

    if (cachingParameters) {
      return Promise.resolve(cachingParameters.blocksToLive)
    } else {
      return Promise.resolve(0)
    }
  }

  protected async _getCachedRoute(
    chainId: ChainId,
    amount: CurrencyAmount<Currency>,
    quoteToken: Token,
    tradeType: TradeType,
    protocols: Protocol[]
  ): Promise<CachedRoutes | undefined> {
    const [tokenIn, tokenOut] = this.determineTokenInOut(amount, quoteToken, tradeType)
    const cachedRoutesStrategy = this.getCachedRoutesStrategy(tokenIn, tokenOut, tradeType, chainId)
    const cachingParameters = cachedRoutesStrategy?.getCachingParameters(amount)

    if (cachingParameters) {
      const pk = `${tokenIn.address}/${tokenOut.address}/${tradeType}/${chainId}`
      const sk = `${protocols}/${cachingParameters.bucket}/`

      const queryParams = {
        TableName: this.tableName,
        KeyConditionExpression: '#pk = :pk and begins_with(#sk, :sk)',
        ExpressionAttributeNames: {
          '#pk': 'pairTradeTypeChainId',
          '#sk': 'protocolsAmountBlockNumber',
        },
        ExpressionAttributeValues: {
          ':pk': { S: pk },
          ':sk': { S: sk },
        },
        ScanIndexForward: false, // Reverse order to retrieve most recent item first
        Limit: 1, // Only retrieve the most recent item
      }

      try {
        const result = await this.ddbClient.query(queryParams).promise()
        if (result.Items && result.Items.length > 0) {
          const resultBinary = result.Items[0]?.item?.B
          const cachedRoutesBuffer = Buffer.from(resultBinary)
          const cachedRoutesJson = JSON.parse(cachedRoutesBuffer.toString())
          const cachedRoutes: CachedRoutes = CachedRoutesMarshaller.unmarshal(cachedRoutesJson)

          return cachedRoutes
        } else {
          // No items found
        }
      } catch (error) {
        // Error calling DynamoDB
      }
    }

    // We only get here if we didn't find a cachedRoutes
    return undefined
  }

  protected async _setCachedRoute(cachedRoutes: CachedRoutes, amount: CurrencyAmount<Currency>): Promise<boolean> {
    const cachedRoutesStrategy = this.getCachedRoutesStrategyFromCachedRoutes(cachedRoutes)
    const cachingParameters = cachedRoutesStrategy?.getCachingParameters(amount)

    if (cachingParameters) {
      // TTL is 10 minutes from now. 600 seconds  = 10 minutes
      const ttl = Math.floor(Date.now() / 1000) + 600
      const marshalledCachedRoutes = CachedRoutesMarshaller.marshal(cachedRoutes)
      const jsonCachedRoutes = JSON.stringify(marshalledCachedRoutes)

      const putParams = {
        TableName: this.tableName,
        Item: {
          pairTradeTypeChainId: {
            S: `${cachedRoutes.tokenIn.address}/${cachedRoutes.tokenOut.address}/${cachedRoutes.tradeType}/${cachedRoutes.chainId}`,
          },
          protocolsAmountBlockNumber: {
            S: `${cachedRoutes.protocolsCovered}/${cachingParameters.bucket}/${cachedRoutes.blockNumber}`,
          },
          item: { B: Buffer.from(jsonCachedRoutes) },
          ttl: { N: ttl.toString() },
        },
      }

      try {
        await this.ddbClient.put(putParams).promise()
        return true
      } catch (error) {
        // log error, maybe?
        return false
      }
    } else {
      return false
    }
  }

  getCacheMode(
    chainId: ChainId,
    amount: CurrencyAmount<Currency>,
    quoteToken: Token,
    tradeType: TradeType,
    _protocols: Protocol[]
  ): Promise<CacheMode> {
    const [tokenIn, tokenOut] = this.determineTokenInOut(amount, quoteToken, tradeType)
    const cachedRoutesStrategy = this.getCachedRoutesStrategy(tokenIn, tokenOut, tradeType, chainId)
    const cachingParameters = cachedRoutesStrategy?.getCachingParameters(amount)

    if (cachingParameters) {
      log.info(
        {
          cachedRoutesStrategy: cachedRoutesStrategy,
          cachingParameters: cachingParameters,
          tokenIn: tokenIn.address,
          tokenOut: tokenOut.address,
          pair: `${tokenIn.symbol}/${tokenOut.symbol}`,
          chainId,
          tradeType,
          amount: amount.toExact()
        },
        `[DynamoRouteCachingProvider] Got CachingParameters for ${amount.toExact()} in ${tokenIn.symbol}/${tokenOut.symbol}/${tradeType}/${chainId}`
      )

      return Promise.resolve(cachingParameters.cacheMode)
    } else {
      log.info(
        {
          cachedRoutesStrategy: cachedRoutesStrategy,
          cachingParameters: cachingParameters,
          tokenIn: tokenIn.address,
          tokenOut: tokenOut.address,
          pair: `${tokenIn.symbol}/${tokenOut.symbol}`,
          chainId,
          tradeType,
          amount: amount.toExact()
        },
        `[DynamoRouteCachingProvider] Didn't find CachingParameters for ${amount.toExact()} in ${tokenIn.symbol}/${tokenOut.symbol}/${tradeType}/${chainId}`
      )

      return Promise.resolve(CacheMode.Darkmode)
    }
  }

  private getCachedRoutesStrategyFromCachedRoutes(cachedRoutes: CachedRoutes): CachedRoutesStrategy | undefined {
    return this.getCachedRoutesStrategy(
      cachedRoutes.tokenIn,
      cachedRoutes.tokenOut,
      cachedRoutes.tradeType,
      cachedRoutes.chainId
    )
  }

  private getCachedRoutesStrategy(
    tokenIn: Token,
    tokenOut: Token,
    tradeType: TradeType,
    chainId: ChainId
  ): CachedRoutesStrategy | undefined {
    const pairTradeTypeChainId = new PairTradeTypeChainId({
      tokenIn: tokenIn.address.toLowerCase(),
      tokenOut: tokenOut.address.toLowerCase(),
      tradeType: tradeType,
      chainId: chainId,
    })

    log.info({pairTradeTypeChainId}, `[DynamoRouteCachingProvider] Looking for cache configuration of ${pairTradeTypeChainId.toString()}`)

    return CACHED_ROUTES_CONFIGURATION.get(pairTradeTypeChainId.toString())
  }

  private determineTokenInOut(
    amount: CurrencyAmount<Currency>,
    quoteToken: Token,
    tradeType: TradeType
  ): [Token, Token] {
    if (tradeType == TradeType.EXACT_INPUT) {
      return [amount.currency.wrapped, quoteToken]
    } else {
      return [quoteToken, amount.currency.wrapped]
    }
  }
}
