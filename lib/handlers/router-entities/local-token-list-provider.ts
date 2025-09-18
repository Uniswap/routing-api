import defaultTokenList from '@uniswap/default-token-list/build/uniswap-default.tokenlist.json'
import { CachingTokenListProvider, NodeJSCache } from '@juiceswapxyz/smart-order-router'
import { ChainId } from '@juiceswapxyz/sdk-core'
import NodeCache from 'node-cache'

export function createLocalTokenListProvider(chainId: ChainId) {
  const tokenCache = new NodeCache({ stdTTL: 360, useClones: false })
  return CachingTokenListProvider.fromTokenList(chainId, defaultTokenList as any, new NodeJSCache(tokenCache))
}