import { DynamoDB } from 'aws-sdk'
import { dbConnectionSetup } from './dynamoDBLocalFixture'

const createTable = async (table: DynamoDB.Types.CreateTableInput) => {
  const ddb = getDdbOrDie()

  await ddb.createTable(table).promise()
}

const getDdbOrDie = (): DynamoDB => {
  const ddb = (global as any)['__DYNAMODB_CLIENT__'] as DynamoDB

  if (ddb === undefined) {
    throw new Error()
  }

  return ddb
}

export const deleteAllTables = async () => {
  const ddb = getDdbOrDie()
  const { TableNames: tableNames } = await ddb.listTables().promise()

  if (tableNames === undefined) {
    return
  }

  await Promise.all(tableNames.map((t) => ddb.deleteTable({ TableName: t }).promise()))
}

export const setupTables = (...tables: DynamoDB.Types.CreateTableInput[]) => {
  dbConnectionSetup()
  beforeEach(async () => {
    await Promise.all(tables.map(createTable))
  })

  afterEach(async () => {
    await deleteAllTables()
  })
}
