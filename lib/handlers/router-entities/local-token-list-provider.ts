import defaultTokenList from '@uniswap/default-token-list/build/uniswap-default.tokenlist.json'
import { CachingTokenListProvider, NodeJSCache } from '@uniswap/smart-order-router'
import { ChainId } from '@uniswap/sdk-core'
import NodeCache from 'node-cache'

export function createLocalTokenListProvider(chainId: ChainId) {
  const tokenCache = new NodeCache({ stdTTL: 360, useClones: false })
  return CachingTokenListProvider.fromTokenList(chainId, defaultTokenList as any, new NodeJSCache(tokenCache))
}