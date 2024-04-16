import { FallbackHandler } from './FallbackHandler'

import { default as bunyan, default as Logger } from 'bunyan'

const log: Logger = bunyan.createLogger({
  name: 'Root',
  serializers: bunyan.stdSerializers,
  level: bunyan.DEBUG
})

let fallbackHandler: FallbackHandler
try {
  fallbackHandler = new FallbackHandler(log)
} catch (error) {
  log.fatal({ error }, 'Fatal error')
  throw error
}

module.exports = {
  fallbackHandler: fallbackHandler.handler
}
