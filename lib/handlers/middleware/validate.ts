import { MiddlewareObj } from '@middy/core';
import middy from '@middy/core';
import Joi from '@hapi/joi';
import { BadRequest } from 'http-json-errors';

export interface ValidateJoiParams {
  bodySchema?: Joi.Schema;
  queryStringSchema?: Joi.Schema;
}
export const validateJoi = (params: ValidateJoiParams): MiddlewareObj => {
  const { bodySchema, queryStringSchema } = params;
  return {
    before: (request: middy.Request) => {
      if (!bodySchema && !queryStringSchema) {
        return;
      }

      const schema = Joi.object({
        ...(bodySchema ? { body: bodySchema } : {}),
        ...(queryStringSchema
          ? { queryStringParameters: queryStringSchema }
          : {}),
      });

      console.log({ request, event: request.event }, 'About to validate');

      const res = schema.validate(request.event, {
        allowUnknown: true,
        stripUnknown: false,
      });

      console.log({ res }, 'Validate result');

      if (res.error) {
        throw new BadRequest(res.error.message, res.error.details[0].message);
      }
    },
  };
};
