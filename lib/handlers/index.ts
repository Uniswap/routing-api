import { QuoteHandler } from './quote/quote';
import { QuoteHandlerInjector } from "./quote/injector";

const quoteHandlerInjector = new QuoteHandlerInjector();
quoteHandlerInjector.build();
const quoteHandler = new QuoteHandler('quote', quoteHandlerInjector);

module.exports = { quoteHandler: quoteHandler.handler };
