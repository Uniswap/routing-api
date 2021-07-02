import { QuoteHandler } from './quote/quote';
import { QuoteHandlerInjector } from "./quote/injector";

const injectorPromise = new QuoteHandlerInjector('quoteInjector').build();

const quoteHandler = new QuoteHandler('quote', injectorPromise);

module.exports = { quoteHandler: quoteHandler.handler };
