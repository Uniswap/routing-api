import { FallbackHandler } from './FallbackHandler'

import { default as bunyan, default as Logger } from 'bunyan'

const log: Logger = bunyan.createLogger({
  name: 'Root',
  serializers: bunyan.stdSerializers,
  level: bunyan.ERROR,
})

let fallbackHandler: FallbackHandler
try {
  fallbackHandler = new FallbackHandler(log)
} catch (error) {
  log.fatal({ error }, 'Unable to construct FallbackHandler')
  throw error
}

module.exports = {
  fallbackHandler: fallbackHandler.handler,
}
