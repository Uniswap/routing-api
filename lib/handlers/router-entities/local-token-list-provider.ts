import defaultTokenList from '@uniswap/default-token-list/build/uniswap-default.tokenlist.json'
import citreaTestnetTokenList from '../../config/citrea-testnet.tokenlist.json'
import { CachingTokenListProvider, NodeJSCache } from '@juiceswapxyz/smart-order-router'
import { ChainId } from '@juiceswapxyz/sdk-core'
import NodeCache from 'node-cache'
import { getJuiceswapLatestTokens } from './getJuiceswapLatestTokens'

export async function createLocalTokenListProvider(chainId: ChainId) {
  const tokenCache = new NodeCache({ stdTTL: 360, useClones: false })
  
  if (chainId === ChainId.CITREA_TESTNET) {
    const juiceswapLatestTokens = await getJuiceswapLatestTokens()
    const map = new Map<string, any>()
    
    juiceswapLatestTokens.forEach(token => map.set(token.address, token))
    citreaTestnetTokenList.tokens.forEach((token: any) => map.set(token.address, token))
    
    const aggregatedTokenList = {
      ...citreaTestnetTokenList,
      tokens: Array.from(map.values()),
    }
    
    return CachingTokenListProvider.fromTokenList(chainId, aggregatedTokenList as any, new NodeJSCache(tokenCache))
  }
  
  return CachingTokenListProvider.fromTokenList(chainId, defaultTokenList as any, new NodeJSCache(tokenCache))
}