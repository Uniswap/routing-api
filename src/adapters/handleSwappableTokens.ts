import { Request, Response } from 'express';
import citreaTokenList from '../../lib/config/citrea-testnet.tokenlist.json';

interface Token {
  address: string;
  chainId: number;
  decimals: number;
  name: string;
  symbol: string;
  logoURI?: string;
}

export const handleSwappableTokens = async (req: Request, res: Response) => {
  try {
    const { tokenIn, tokenInChainId } = req.query;

    if (!tokenInChainId) {
      res.status(400).json({ message: 'Missing tokenInChainId parameter' });
      return;
    }

    const chainId = parseInt(tokenInChainId.toString());

    // For now, only support Citrea Testnet (5115)
    if (chainId !== 5115) {
      res.status(200).json({ tokens: [] });
      return;
    }

    // Get all tokens from the token list
    let tokens: Token[] = citreaTokenList.tokens as Token[];

    // Filter out the input token if specified
    if (tokenIn) {
      const tokenInAddress = tokenIn.toString().toLowerCase();
      tokens = tokens.filter(token => token.address.toLowerCase() !== tokenInAddress);
    }

    // Return tokens in the expected format
    res.status(200).json({
      tokens: tokens.map(token => ({
        address: token.address,
        chainId: token.chainId,
        decimals: token.decimals,
        name: token.name,
        symbol: token.symbol,
        logoURI: token.logoURI || `https://raw.githubusercontent.com/Uniswap/assets/master/blockchains/citrea/assets/${token.address}/logo.png`
      }))
    });
  } catch (error: any) {
    console.error('Error in handleSwappableTokens:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};