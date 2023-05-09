import chai, { expect } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import 'reflect-metadata'
import { setupTables } from '../../../../mocha/dbSetup'
import { DynamoRouteCachingProvider } from '../../../../../lib/handlers/router-entities/route-caching'
import { Protocol } from '@uniswap/router-sdk'
import { ChainId } from '@uniswap/smart-order-router'
import { CurrencyAmount, Token, TradeType } from '@uniswap/sdk-core'
import JSBI from 'jsbi'

chai.use(chaiAsPromised)

const routeTable = {
  TableName: 'RouteCachingDB',
  KeySchema: [
    {
      AttributeName: 'pairTradeTypeChainId',
      KeyType: 'HASH',
    },
  ],
  AttributeDefinitions: [
    {
      AttributeName: 'pairTradeTypeChainId',
      AttributeType: 'S',
    },
  ],
  ProvisionedThroughput: {
    ReadCapacityUnits: 1,
    WriteCapacityUnits: 1,
  },
}

export const UNI_MAINNET = new Token(
  ChainId.MAINNET,
  '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
  18,
  'UNI',
  'Uniswap'
)

describe('DynamoRouteCachingProvider', async () => {
  setupTables(routeTable)

  it('No routes cached in db returns undefined', async () => {
    const dynamoRouteCache = new DynamoRouteCachingProvider({ cachedRoutesTableName: routeTable.TableName })
    const route = await dynamoRouteCache.getCachedRoute(
      1,
      CurrencyAmount.fromRawAmount(UNI_MAINNET, JSBI.BigInt(1)),
      UNI_MAINNET,
      TradeType.EXACT_INPUT,
      [Protocol.V3],
      1
    )
    expect(route).to.be.undefined
  })
})
