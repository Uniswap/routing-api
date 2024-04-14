export async function handler(event: any) {
  // TODO implement
  const response = {
    statusCode: 200,
    body: JSON.stringify('Jiejie received alarm!!'),
  }
  console.log(`jiejie: received alarm!`)
  console.log(`jiejie: event looks like this`)
  console.log(`${JSON.stringify(event)}`)
  return response
}
