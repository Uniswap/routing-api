import { Token } from '@uniswap/sdk-core';
import {
  DefaultRouter,
  HeuristicGasModelFactory,
  ID_TO_CHAIN_ID,
  ID_TO_NETWORK_NAME,
  Multicall2Provider,
  parseAmount,
  PoolProvider,
  QuoteProvider,
  routeAmountToString,
  SwapRoute,
  TokenProvider,
} from '@uniswap/smart-order-router';
import { metricScope, MetricsLogger } from 'aws-embedded-metrics';
import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
  Handler,
} from 'aws-lambda';
import { default as bunyan, default as Logger } from 'bunyan';
import { ethers, providers } from 'ethers';
import { AWSMetricsLogger } from '../quote/aws-metrics-logger';
import { AWSSubgraphProvider } from '../quote/aws-subgraph-provider';
import { CachingGasStationProvider } from '../quote/caching-gas-provider';
import { QuoteBody, QuoteBodySchemaJoi } from '../schema/quote';

export const quoteHandler: Handler<APIGatewayProxyEvent> = metricScope(
  (metrics: MetricsLogger) =>
    async (
      event: APIGatewayProxyEvent,
      context: Context
    ): Promise<APIGatewayProxyResult> => {
      const logLevel = bunyan.INFO;
      let log: Logger = bunyan.createLogger({
        name: 'RoutingLambda',
        serializers: bunyan.stdSerializers,
        level: logLevel,
        requestId: context.awsRequestId,
      });
      
      metrics.setNamespace('Uniswap');
      metrics.setDimensions({ Service: 'RoutingAPI' });
      const metricLogger = new AWSMetricsLogger(metrics, log);

      log.info({ event, context }, 'Request started.');

      let body: any;
      try {
        body = JSON.parse(event.body ?? '');
      } catch (err) {
        return { statusCode: 422, body: '' };
      }

      const res = QuoteBodySchemaJoi.validate(body, {
        allowUnknown: true,
        stripUnknown: false,
      });

      if (res.error) {
        return { statusCode: 400, body: res.error.message };
      }

      const request = res.value as QuoteBody;

      const {
        tokenIn: tokenInStr,
        tokenOut: tokenOutStr,
        chainId: chainIdNum,
        amount: amountStr,
        config: routingConfig,
      } = request;

      log = log.child({
        tokenIn: tokenInStr,
        tokenOut: tokenOutStr,
        chainId: chainIdNum,
        amount: amountStr,
      });

      const tokenListURI = 'https://gateway.ipfs.io/ipns/tokens.uniswap.org';

      const chainId = ID_TO_CHAIN_ID(chainIdNum);
      const chainName = ID_TO_NETWORK_NAME(chainIdNum);

      const provider = new ethers.providers.InfuraProvider(
        chainName,
        process.env.INFURA_KEY
      ) as providers.BaseProvider;

      const multicall2Provider = new Multicall2Provider(provider, log);
      const tokenProvider = await TokenProvider.fromTokenListURI(
        tokenListURI,
        log,
        metricLogger
      );

      const { POOL_CACHE_BUCKET, POOL_CACHE_KEY } = process.env;

      const router = new DefaultRouter({
        chainId,
        subgraphProvider: new AWSSubgraphProvider(
          POOL_CACHE_BUCKET!,
          POOL_CACHE_KEY!,
          log
        ),
        multicall2Provider: new Multicall2Provider(provider, log),
        poolProvider: new PoolProvider(multicall2Provider, log),
        quoteProvider: new QuoteProvider(multicall2Provider, log),
        gasPriceProvider: new CachingGasStationProvider(log),
        gasModelFactory: new HeuristicGasModelFactory(log),
        tokenProvider,
        metricLogger,
        log,
      });

      const tokenIn: Token = tokenProvider.getToken(chainId, tokenInStr);
      const tokenOut: Token = tokenProvider.getToken(chainId, tokenOutStr);
      const amountIn = parseAmount(amountStr, tokenIn);

      const swapRoute: SwapRoute | null = await router.routeExactIn(
        tokenIn,
        tokenOut,
        amountIn,
        routingConfig
      );

      if (!swapRoute) {
        return { statusCode: 500, body: 'No route found' };
      }

      const { quote, quoteGasAdjusted, routeAmounts } = swapRoute;

      const routeStrings = routeAmounts.map((routeAmount) => {
        return routeAmountToString(routeAmount);
      });

      const result = {
        routes: routeStrings,
        gasAdjustedQuote: quoteGasAdjusted.toFixed(2),
        rawQuote: quote.toFixed(2),
      };

      log.info({ result }, 'Request ended.');
      return { statusCode: 200, body: JSON.stringify(result) };
    }
);
