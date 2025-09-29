// Adaptation of https://github.com/hemilabs/uniswap-routing-api/blob/1a9c58fbf82830b608cd59f0529134c3de52c886/lib/handlers/router-entities/hemi-token-list-provider.ts
import { ChainId } from '@uniswap/sdk-core'
import { CachingTokenListProvider, ITokenListProvider, ITokenProvider, NodeJSCache } from '@uniswap/smart-order-router'
import { TokenList } from '@uniswap/token-lists'
import NodeCache from 'node-cache'
import fs from "node:fs";
import path from "path";

const tokenCache = new NodeCache({ stdTTL: 360, useClones: false })

const tokenListPath = path.resolve(__dirname, "../../..", "token-list.json");
const ethrexTokenList = JSON.parse(fs.readFileSync(tokenListPath, "utf8"));

const ethrex = {
    id: 65536999,
    name: 'Ethrex',
    nativeCurrency: {
        decimals: 18,
        name: 'Ether',
        symbol: 'ETH',
    },
}

const nativeTokens = [
    {
        address: 'ETH',
        chainId: ethrex.id,
        decimals: ethrex.nativeCurrency.decimals,
        name: ethrex.nativeCurrency.name,
        symbol: ethrex.nativeCurrency.symbol,
    },
]

const tokenList: TokenList = {
    ...ethrexTokenList,
    tokens: [
        ...ethrexTokenList.tokens,
        ...nativeTokens
    ]
}

export class EthrexTokenListProvider {
    public static async fromTokenList(chainId: ChainId): Promise<ITokenListProvider & ITokenProvider> {
        return new CachingTokenListProvider(chainId, tokenList, new NodeJSCache(tokenCache))
    }
}
