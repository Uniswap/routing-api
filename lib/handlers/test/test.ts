import {
  AlphaRouterConfig,
  IRouter,
} from '@uniswap/smart-order-router'
import Joi from '@hapi/joi'
import _ from 'lodash'
import { APIGLambdaHandler, ErrorResponse, HandleRequestParams, Response } from '../handler'
import { ContainerInjected, RequestInjected } from '../injector-sor'
import { QuoteQueryParams } from '../quote/schema/quote-schema'

export class TestHandler extends APIGLambdaHandler<
  ContainerInjected,
  RequestInjected<IRouter<AlphaRouterConfig>>,
  void,
  QuoteQueryParams,
  null
> {
  public async handleRequest(
    params: HandleRequestParams<ContainerInjected, RequestInjected<IRouter<any>>, void, QuoteQueryParams>
  ): Promise<Response<null> | ErrorResponse> {

    let result: Response<null> | ErrorResponse

    try {
      result = await this.handleRequestInternal(params)
    } catch (err) {
      throw err
    }

    return result
  }

  private async handleRequestInternal(
    params: HandleRequestParams<ContainerInjected, RequestInjected<IRouter<any>>, void, QuoteQueryParams>
  ): Promise<Response<null> | ErrorResponse> {
    const {
      requestQueryParams: {
      },
      requestInjected: {
        log,
      },
    } = params

    log.info(
        `SECONDARY ROUTING LAMBDA HAS BEEN FIRED.`
      )

    return {
      statusCode: 200,
      body: null,
    }
  }


  protected requestBodySchema(): Joi.ObjectSchema | null {
    return null
  }

  protected requestQueryParamsSchema(): Joi.ObjectSchema | null {
    return QuoteQueryParamsJoi
  }

  protected responseBodySchema(): Joi.ObjectSchema | null {
    return QuoteResponseSchemaJoi
  }

}
