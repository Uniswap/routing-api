import { QuoteHandlerInjector } from './quote/injector'
import { QuoteHandler } from './quote/quote'

const quoteInjectorPromise = new QuoteHandlerInjector('quoteInjector').build()

const quoteHandler = new QuoteHandler('quote', quoteInjectorPromise)

module.exports = {
  quoteHandler: quoteHandler.handler,
}
