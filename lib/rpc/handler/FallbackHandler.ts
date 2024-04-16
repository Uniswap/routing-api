import Logger from 'bunyan'

export class FallbackHandler {
  constructor(readonly log: Logger) {

  }

  get handler() {
    return async(event: any)=> {
      // TODO implement
      const response = {
        statusCode: 200,
        body: JSON.stringify('Jiejie received alarm!!'),
      }
      console.log(`jiejie: received alarm!`)
      console.log(`jiejie: event looks like this`)
      console.log(`${JSON.stringify(event)}`)
      this.log.debug(event, `jiejie used bunyan logger in handler`)
      return response
    }
  }
}
