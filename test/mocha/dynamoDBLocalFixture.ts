import AWS, { DynamoDB } from 'aws-sdk'
import { ChildProcess } from 'child_process'
import DDBLocal from 'dynamodb-local'
import { deleteAllTables } from './dbSetup'

process.env.AWS_ACCESS_KEY_ID = 'my_access_key'
process.env.AWS_SECRET_ACCESS_KEY = 'my_secret_key'

const dbPort = Number(process.env.DYNAMODB_LOCAL_PORT || 8000)

let dbInstance: ChildProcess | undefined
;(global as any)['__DYNAMODB_LOCAL__'] = true

export const mochaGlobalSetup = async () => {
  try {
    console.log('Starting DynamoDB')
    dbInstance = await DDBLocal.launch(dbPort, null)
    console.log('Started DynamoDB')

    const ddb = new DynamoDB({
      endpoint: `localhost:${dbPort}`,
      sslEnabled: false,
      region: 'local',
    })

    dbConnectionSetup()

    exportDDBInstance(ddb)

    await deleteAllTables()
  } catch (e) {
    console.log('Error instantiating DynamoDB', e)
  }
}

// Overrides the default config to use the local instance of DynamoDB in tests
export const dbConnectionSetup = () => {
  const config: any = AWS.config

  const dynamoLocalPort = Number(process.env.DYNAMODB_LOCAL_PORT || 8000)
  config.endpoint = `localhost:${dynamoLocalPort}`
  config.sslEnabled = false
  config.region = 'local'
}

const exportDDBInstance = (ddb: DynamoDB) => {
  ;(global as any)['__DYNAMODB_CLIENT__'] = ddb
}

export const mochaGlobalTeardown = async () => {
  console.log('Stopping DynamoDB')
  if (dbInstance !== undefined) {
    await DDBLocal.stopChild(dbInstance)
  }
  console.log('Stopped DynamoDB')
}
