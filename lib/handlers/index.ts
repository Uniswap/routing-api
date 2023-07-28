import { QuoteHandlerInjector } from './quote/injector'
import { QuoteHandler } from './quote/quote'
import { TestHandler } from './test/test'
import { TestHandlerInjector } from './test/injector'

const quoteInjectorPromise = new QuoteHandlerInjector('quoteInjector').build()

const quoteHandler = new QuoteHandler('quote', quoteInjectorPromise)

const testInjectorPromise = new TestHandlerInjector('testInjector').build()

const testHandler = new TestHandler('test', testInjectorPromise)

module.exports = {
  quoteHandler: quoteHandler.handler,
  testHandler: testHandler.handler,
}