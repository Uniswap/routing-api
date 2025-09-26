import axios from 'axios'
import { log } from '@juiceswapxyz/smart-order-router'

export interface HttpTokenResponse {
  tokens: {
    address: string
    symbol: string
    decimals: number
    name?: string
  }[]
}

export async function getJuiceswapLatestTokens() {
  try {
    const url = process.env.PONDER_URL || 'https://ponder.juiceswap.com'
    const response = await axios.get<HttpTokenResponse>(`${url}/tokens/all`, {
      timeout: 2000
    })
    log.info(`Got juiceswap latest tokens from ${url} with ${response.data.tokens.length} tokens`)
    return response.data.tokens.map((token) => ({
      ...token,
      chainId: 5115,
      logoURI: '',
    }))
  } catch (error) {
    log.error({ error }, `Error getting juiceswap latest tokens`)
    return []
  }
}
