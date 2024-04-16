import Logger from 'bunyan'

export class FallbackHandler {
  constructor(readonly log: Logger) {

  }

  get handler() {
    return async(event: any)=> {
      // TODO implement
      const response = {
        statusCode: 200,
        body: JSON.stringify('Received alarm!!'),
      }
      this.log.debug(event, 'received event object')
      return response
    }
  }
}
