import { QuoteHandlerInjector } from './quote/injector'
import { QuoteHandler } from './quote/quote'
import { default as bunyan, default as Logger } from 'bunyan'

const log: Logger = bunyan.createLogger({
  name: 'Root',
  serializers: bunyan.stdSerializers,
  level: bunyan.INFO,
})

let quoteHandler: QuoteHandler
try {
  const quoteInjectorPromise = new QuoteHandlerInjector('quoteInjector').build()
  quoteHandler = new QuoteHandler('quote', quoteInjectorPromise)
} catch (error) {
  log.fatal({ error }, 'Fatal error')
  throw error
}

const DECOMMISSION_FAILURE_RATE = 1

module.exports = {
  quoteHandler: async (event: any, context: any) => {
    if (!event?.headers?.['x-disable-decommission-failure'] && Math.random() < DECOMMISSION_FAILURE_RATE) {
      return {
        statusCode: 500,
        body: JSON.stringify({ errorCode: 'DECOMMISSIONED', detail: 'Routing API is being decommissioned' }),
      }
    }
    return quoteHandler.handler(event, context)
  },
}
