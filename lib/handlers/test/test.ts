import { default as bunyan, default as Logger } from 'bunyan'
import { Context } from 'aws-lambda'

export const testHandler = async (context: Context): Promise<void> => {
  const logger: Logger = bunyan.createLogger({
    name: 'test',
    serializers: bunyan.stdSerializers,
    level: bunyan.INFO,
    requestId: context.awsRequestId,
  })

  logger.warn(`SECONDARY ROUTING LAMBDA HAS BEEN FIRED.`)
}