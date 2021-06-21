import DEFAULT_TOKEN_LIST from '@uniswap/default-token-list';
import { Currency, CurrencyAmount, Ether, Percent } from '@uniswap/sdk-core';
import {
  AlphaRouter,
  HeuristicGasModelFactory,
  ID_TO_CHAIN_ID,
  ID_TO_NETWORK_NAME,
  LegacyRouter,
  Multicall2Provider,
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
import { ethers } from 'ethers';
import { parseUnits } from 'ethers/lib/utils';
import JSBI from 'jsbi';
import { QuoteBody, QuoteBodySchemaJoi } from '../../schema/quote';
import { AWSMetricsLogger } from './router-entities/aws-metrics-logger';
import { AWSSubgraphProvider } from './router-entities/aws-subgraph-provider';
import { CachingGasStationProvider } from './router-entities/caching-gas-provider';

export const quoteHandler: Handler<APIGatewayProxyEvent> = metricScope(
  (metrics: MetricsLogger) =>
    async (
      event: APIGatewayProxyEvent,
      context: Context
    ): Promise<APIGatewayProxyResult> => {
      const requestId = context.awsRequestId;
      const quoteId = requestId.substring(0, 5);

      const logLevel = bunyan.INFO;
      let log: Logger = bunyan.createLogger({
        name: 'RoutingLambda',
        serializers: bunyan.stdSerializers,
        level: logLevel,
        requestId,
        quoteId,
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
        type,
        recipient,
        slippageTolerance,
        deadline,
        algorithm,
      } = request;

      log = log.child({
        tokenIn: tokenInStr,
        tokenOut: tokenOutStr,
        chainId: chainIdNum,
        amount: amountStr,
        type,
        algorithm,
      });

      // const tokenListURI = 'https://gateway.ipfs.io/ipns/tokens.uniswap.org';

      const chainId = ID_TO_CHAIN_ID(chainIdNum);
      const chainName = ID_TO_NETWORK_NAME(chainIdNum);

      const provider = new ethers.providers.JsonRpcProvider(
        process.env.JSON_RPC_URL,
        chainName
      );

      const multicall2Provider = new Multicall2Provider(provider, log);
      const tokenProvider = await TokenProvider.fromTokenList(
        DEFAULT_TOKEN_LIST,
        log,
        metricLogger
      );

      const { POOL_CACHE_BUCKET, POOL_CACHE_KEY } = process.env;

      let currencyIn: Currency;
      let currencyOut: Currency;

      if (tokenInStr == 'ETH') {
        currencyIn = Ether.onChain(chainId);
      } else {
        currencyIn = tokenProvider.getToken(chainId, tokenInStr);
      }

      if (tokenOutStr == 'ETH') {
        currencyOut = Ether.onChain(chainId);
      } else {
        currencyOut = tokenProvider.getToken(chainId, tokenOutStr);
      }

      // e.g. "1.25" => 1.25 => 125 => 125 / 10000
      const slippagePer10k = Math.round(parseFloat(slippageTolerance) * 100);
      const swapParams = {
        deadline: Math.floor(Date.now() / 1000) + parseInt(deadline),
        recipient: recipient,
        slippageTolerance: new Percent(slippagePer10k, 10_000),
      };

      let router;

      if (!algorithm || algorithm == 'alpha') {
        log.info({ algorithm }, 'Using Alpha Algorithm');
        router = new AlphaRouter({
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
      } else {
        log.info({ algorithm }, 'Using Legacy Algorithm');
        router = new LegacyRouter({
          chainId,
          multicall2Provider: new Multicall2Provider(provider, log),
          poolProvider: new PoolProvider(multicall2Provider, log),
          quoteProvider: new QuoteProvider(multicall2Provider, log),
          tokenProvider,
          log,
        });
      }

      let swapRoute: SwapRoute | null;
      if (type == 'exactIn') {
        const typedValueParsed = parseUnits(amountStr, currencyIn.decimals);
        const amountIn = CurrencyAmount.fromRawAmount(
          currencyIn,
          JSBI.BigInt(typedValueParsed)
        );

        log.info(
          {
            amountIn: amountIn.toExact(),
            currency: amountIn.currency.symbol,
          },
          `Exact In Swap: Give ${amountIn.toExact()} ${
            amountIn.currency.symbol
          }, Want: ${currencyOut.symbol}`
        );

        swapRoute = await router.routeExactIn(
          currencyIn,
          currencyOut,
          amountIn,
          swapParams,
          routingConfig
        );
      } else {
        const typedValueParsed = parseUnits(amountStr, currencyOut.decimals);
        const amountOut = CurrencyAmount.fromRawAmount(
          currencyOut,
          JSBI.BigInt(typedValueParsed)
        );

        log.info(
          {
            amountIn: amountOut.toExact(),
            currency: amountOut.currency.symbol,
          },
          `Exact Out Swap: Want ${amountOut.toExact()} ${
            amountOut.currency.symbol
          } Give: ${currencyIn.symbol}`
        );

        swapRoute = await router.routeExactOut(
          currencyIn,
          currencyOut,
          amountOut,
          swapParams,
          routingConfig
        );
      }

      if (!swapRoute) {
        return { statusCode: 500, body: 'No route found' };
      }

      const {
        quote,
        quoteGasAdjusted,
        routeAmounts,
        estimatedGasUsed,
        gasPriceWei,
        methodParameters,
        blockNumber,
      } = swapRoute;

      const routeStrings = routeAmounts.map((routeAmount) => {
        return routeAmountToString(routeAmount);
      });

      const result = {
        methodParameters,
        blockNumber: blockNumber.toString(),
        estimatedGasUsed: estimatedGasUsed.toString(),
        gasPriceWei: gasPriceWei.toString(),
        routes: routeStrings,
        gasAdjustedQuote: quoteGasAdjusted.toExact(),
        rawQuote: quote.toExact(),
        quoteId,
      };

      log.info({ result }, 'Request ended.');
      return { statusCode: 200, body: JSON.stringify(result) };
    }
);
