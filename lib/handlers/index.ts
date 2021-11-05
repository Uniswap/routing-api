import { QuoteToRatioHandlerInjector } from './quote-to-ratio/injector'
import { QuoteToRatioHandler } from './quote-to-ratio/quote-to-ratio'
import { QuoteHandlerInjector } from './quote/injector'
import { QuoteHandler } from './quote/quote'

const quoteInjectorPromise = new QuoteHandlerInjector('quoteInjector').build()
const quoteToRatioInjectorPromise = new QuoteToRatioHandlerInjector('quoteToRatioInjector').build()

const quoteHandler = new QuoteHandler('quote', quoteInjectorPromise)
const quoteToRatioHandler = new QuoteToRatioHandler('quote-to-ratio', quoteToRatioInjectorPromise)

module.exports = {
  quoteHandler: quoteHandler.handler,
  quoteToRatioHandler: quoteToRatioHandler.handler,
}
