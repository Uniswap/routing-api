import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Currency, CurrencyAmount } from '@uniswap/sdk-core'
import hre from 'hardhat'
import { Erc20, Erc20__factory } from '../../lib/types/ext'
const { ethers } = hre
import { BigNumber, providers } from 'ethers'

const NFT_POSITION_MANAGER = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88'

export function parseEvents(
	txReceipt: providers.TransactionReceipt,
) {

	let abi = [
		"event Transfer(address indexed from, address indexed to, uint256 value)",
		"event Approval(address indexed owner, address indexed spender, uint256 value)",
		"event Initialize(uint160 sqrtPriceX96, int24 tick)",
		"event Mint(address sender, address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)",
		"event Collect(address indexed owner, address recipient, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount0, uint128 amount1)",
		"event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)",

	];
	let interfaces = new ethers.utils.Interface(abi);
	let nftInterface = new ethers.utils.Interface([
		"event Collect(uint256 indexed tokenId, address recipient, uint256 amount0, uint256 amount1)",
		"event IncreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)",
		"event DecreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)",
		"event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
		"event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)",
		"event ApprovalForAll(address indexed owner, address indexed _operator, bool approved)",
	])

	return txReceipt.logs.map(log => {
		if (log.address === NFT_POSITION_MANAGER) {
			return {
				origin: log.address,
				...nftInterface.parseLog(log)
			}
		} else {
			return {
				origin: log.address,
				...interfaces.parseLog(log)
			}
		}
	})
}
