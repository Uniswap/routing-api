import { Currency, CurrencyAmount, Token } from '@uniswap/sdk-core'
import { providers } from 'ethers'
import hre from 'hardhat'
import JSBI from 'jsbi'
const { ethers } = hre

const NFT_POSITION_MANAGER = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88'

const GENERIC_INTERFACE = new ethers.utils.Interface([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
  'event Initialize(uint160 sqrtPriceX96, int24 tick)',
  'event Mint(address sender, address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)',
  'event Collect(address indexed owner, address recipient, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount0, uint128 amount1)',
  'event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)',
  'event Approval(address indexed src, address indexed guy, uint wad)',
  'event Transfer(address indexed src, address indexed dst, uint wad)',
  'event Deposit(address indexed dst, uint wad)',
  'event Withdrawal(address indexed src, uint wad)',
])
const NFT_INTERFACE = new ethers.utils.Interface([
  'event Collect(uint256 indexed tokenId, address recipient, uint256 amount0, uint256 amount1)',
  'event IncreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
  'event DecreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  'event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)',
  'event ApprovalForAll(address indexed owner, address indexed _operator, bool approved)',
])

export function parseEvents(txReceipt: providers.TransactionReceipt, addressFilter?: string[]) {
  if (!!addressFilter) {
    addressFilter = addressFilter.map((str) => str.toLowerCase())
  }

  return txReceipt.logs
    .map((log) => {
      if (log.address === NFT_POSITION_MANAGER) {
        return {
          origin: log.address,
          ...NFT_INTERFACE.parseLog(log),
        }
      } else if (!addressFilter || addressFilter.includes(log.address.toLowerCase())) {
        return {
          origin: log.address,
          ...GENERIC_INTERFACE.parseLog(log),
        }
      } else {
        return null
      }
    })
    .filter((n) => n)
}

export type OnChainPosition = {
  owner: string
  tokenId: number
  tickLower: number
  tickUpper: number
  liquidity: number
  amount0: CurrencyAmount<Currency>
  amount1: CurrencyAmount<Currency>
}

export type SwapAndAddEventTestParams = {
  // total amounts transferred from user including anything sent back as dust
  amount0TransferredFromAlice: CurrencyAmount<Currency>
  amount1TransferredFromAlice: CurrencyAmount<Currency>

  // amount of tokenIn swapped through position's target pool
  amount0SwappedInPool: CurrencyAmount<Currency>
  amount1SwappedInPool: CurrencyAmount<Currency>

  // attributes of the on-chain position
  onChainPosition: OnChainPosition
}

export function getTestParamsFromEvents(
  events: any[],
  token0: Token,
  token1: Token,
  aliceAddr: string,
  poolAddr: string,
): SwapAndAddEventTestParams {
  const zeroToken0 = CurrencyAmount.fromRawAmount(token0, JSBI.BigInt('0'))
  const zeroToken1 = CurrencyAmount.fromRawAmount(token1, JSBI.BigInt('0'))
  let amount0TransferredFromAlice = zeroToken0
  let amount1TransferredFromAlice = zeroToken1
  let amount0SwappedInPool =  CurrencyAmount.fromRawAmount(token0, JSBI.BigInt('0'))
  let amount1SwappedInPool =  CurrencyAmount.fromRawAmount(token1, JSBI.BigInt('0'))
  let onChainPosition: OnChainPosition = {
    owner: '0',
    tokenId: 0,
    tickLower: 0,
    tickUpper: 0,
    liquidity: 0,
    amount0: zeroToken0,
    amount1: zeroToken1,
  }

  events.forEach((event) => {
    // get the sum of all tokens transferred from Alice
    if (event.name === 'Transfer' && event.args.value && event.args.from.toLowerCase() === aliceAddr.toLowerCase()) {
      if (event.origin.toLowerCase() === token0.address.toLowerCase()) {
        amount0TransferredFromAlice = amount0TransferredFromAlice.add(
          CurrencyAmount.fromRawAmount(token0, JSBI.BigInt(event.args.value))
        )
      } else if (event.origin.toLowerCase() === token1.address.toLowerCase()) {
        amount1TransferredFromAlice = amount1TransferredFromAlice.add(
          CurrencyAmount.fromRawAmount(token1, JSBI.BigInt(event.args.value))
        )
      }

      // get position details from 'IncreaseLiquidity'
    } else if (event.name === 'IncreaseLiquidity') {
      onChainPosition.tokenId = event.args.tokenId
      onChainPosition.liquidity = event.args.liquidity
      onChainPosition.amount0 = CurrencyAmount.fromRawAmount(token0, JSBI.BigInt(event.args.amount0))
      onChainPosition.amount1 = CurrencyAmount.fromRawAmount(token1, JSBI.BigInt(event.args.amount1))

      // get position owner from nft 'Mint'
    } else if (event.name === 'Transfer' && event.args.tokenId) {
      onChainPosition.owner = event.args.to

      // get position bounds from pool 'Mint'
    } else if (event.name === 'Mint') {
      onChainPosition.tickLower = event.args.tickLower
      onChainPosition.tickUpper = event.args.tickUpper
    } else if (event.name === 'Swap' && event.origin === poolAddr) {
      amount0SwappedInPool = CurrencyAmount.fromRawAmount(token0, JSBI.BigInt(event.args.amount0))
      amount1SwappedInPool = CurrencyAmount.fromRawAmount(token1, JSBI.BigInt(event.args.amount1))
    }
  })

  return {
    amount0TransferredFromAlice,
    amount1TransferredFromAlice,
    amount0SwappedInPool,
    amount1SwappedInPool,
    onChainPosition,
  }
}
