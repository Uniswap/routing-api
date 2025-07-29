import { ChainId } from '@uniswap/sdk-core'

// Bunni pools
export const BUNNI_POOLS_CONFIG = [
  // Bunni USDC-USDT Unichain
  {
    id: '0xeec51c6b1a9e7c4bb4fc4fa9a02fc4fff3fe94efd044f895d98b5bfbd2ff9433',
    chainId: ChainId.UNICHAIN,
    tvlUSD: 40340000,
    tvlETH: 10821.51,
    comment: 'Bunni USDC-USDT Unichain',
    feeTier: '0',
    tickSpacing: '1',
    hooks: '0x005af73a245d8171a0550ffae2631f12cc211888',
    liquidity: '173747248900',
    token0: {
      id: '0x078d782b760474a361dda0af3839290b0ef57ad6',
    },
    token1: {
      id: '0x9151434b16b9763660705744891fa906f660ecc5',
    },
  },
  // Bunni USDC-USDT Mainnet
  {
    id: '0xd9f673912e1da331c9e56c5f0dbc7273c0eb684617939a375ec5e227c62d6707',
    chainId: ChainId.MAINNET,
    tvlUSD: 3470000,
    tvlETH: 930.54,
    comment: 'Bunni USDC-USDT Mainnet',
    feeTier: '0',
    tickSpacing: '1',
    hooks: '0x000052423c1db6b7ff8641b85a7eefc7b2791888',
    liquidity: '173747248900',
    token0: {
      id: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    },
    token1: {
      id: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    },
  },
  // Bunni ETH-weETH Unichain
  {
    id: '0x6923777072439713c7b8ab34903e0ea96078d7148449bf54f420320d59ede857',
    chainId: ChainId.UNICHAIN,
    tvlUSD: 3320000,
    tvlETH: 890.28,
    comment: 'Bunni ETH-weETH Unichain',
    feeTier: '0',
    tickSpacing: '1',
    hooks: '0x000052423c1db6b7ff8641b85a7eefc7b2791888',
    liquidity: '173747248900',
    token0: {
      id: '0x0000000000000000000000000000000000000000',
    },
    token1: {
      id: '0x7dcc39b4d1c53cb31e1abc0e358b43987fef80f7',
    },
  },
  // USR-USDC Mainnet
  {
    id: '0x77f73405a72f844e46d26a0bfd6f145c1a45ffcf6e4af5c86811405f29d2e615',
    chainId: ChainId.MAINNET,
    tvlUSD: 1550000,
    tvlETH: 415.63,
    comment: 'USR-USDC Mainnet',
    feeTier: '0',
    tickSpacing: '10',
    hooks: '0x0010d0d5db05933fa0d9f7038d365e1541a41888',
    liquidity: '173747248900',
    token0: {
      id: '0x66a1e37c9b0eaddca17d3662d6c05f4decf3e110',
    },
    token1: {
      id: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    },
  },
  // USND-USDC Arbitrum
  {
    id: '0x75c55eda2c37c47eaf1db8b500171f72f23dc5b16404e904866a6ad1b3a3e537',
    chainId: ChainId.ARBITRUM_ONE,
    tvlUSD: 895010,
    tvlETH: 240.09,
    comment: 'USND-USDC Arbitrum',
    feeTier: '0',
    tickSpacing: '10',
    hooks: '0x0000eb22c45bdb564f985ace0b4d05a64fa71888',
    liquidity: '173747248900',
    token0: {
      id: '0x4ecf61a6c2fab8a047ceb3b3b263b401763e9d49',
    },
    token1: {
      id: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
    },
  },
  // ETH-BUNNI #1 Mainnet
  {
    id: '0x9148f00424c4b40a9ec4b03912f091138e9e91a60980550ed97ed7f9dc998cb5',
    chainId: ChainId.MAINNET,
    tvlUSD: 842230,
    tvlETH: 225.84,
    comment: 'ETH-BUNNI #1 Mainnet',
    feeTier: '1',
    tickSpacing: '60',
    hooks: '0x0010d0d5db05933fa0d9f7038d365e1541a41888',
    liquidity: '173747248900',
    token0: {
      id: '0x0000000000000000000000000000000000000000',
    },
    token1: {
      id: '0x000000c396558ffbab5ea628f39658bdf61345b3',
    },
  },
  // USDC-USDT #1 Unichain
  {
    id: '0x38eeae8c6d1c205eff7c18ca631c9c65afa357e83fa130ec215aff81741d2408',
    chainId: ChainId.UNICHAIN,
    tvlUSD: 225070,
    tvlETH: 60.36,
    comment: 'USDC-USDT #1 Unichain',
    feeTier: '0',
    tickSpacing: '10',
    hooks: '0x0000fe59823933ac763611a69c88f91d45f81888',
    liquidity: '173747248900',
    token0: {
      id: '0x078d782b760474a361dda0af3839290b0ef57ad6',
    },
    token1: {
      id: '0x588ce4f028d8e7b53b687865d6a67b3a54c75518',
    },
  },
  // USDT-USDf #55 Mainnet
  {
    id: '0x68306351b1155f7329bc4428657aa73b8a32e87e916f897b7dcb1328f2ec60a3',
    chainId: ChainId.MAINNET,
    tvlUSD: 166960,
    tvlETH: 44.77,
    comment: 'USDT-USDf #55 Mainnet',
    feeTier: '0',
    tickSpacing: '10',
    hooks: '0x0000fe59823933ac763611a69c88f91d45f81888',
    liquidity: '173747248900',
    token0: {
      id: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    },
    token1: {
      id: '0xfa2b947eec368f42195f24f36d2af29f7c24cec2',
    },
  },
  // ETH-MET #83 Mainnet
  {
    id: '0xa27d94eb334faeb7e65b2b861d4ea4dc3ddce9bdea10bff37fac9f9f095d2148',
    chainId: ChainId.MAINNET,
    tvlUSD: 125580,
    tvlETH: 33.68,
    comment: 'ETH-MET #83 Mainnet',
    feeTier: '0',
    tickSpacing: '100',
    hooks: '0x000052423c1db6b7ff8641b85a7eefc7b2791888',
    liquidity: '173747248900',
    token0: {
      id: '0x0000000000000000000000000000000000000000',
    },
    token1: {
      id: '0x2ebd53d035150f328bd754d6dc66b99b0edb89aa',
    },
  },
  // Bunni USD0-USD0++ Mainnet
  {
    id: '0x54ff1fd1d62f3bc6224082ecfdb3190a34e8428611b058ade19ce6c083cb608b',
    chainId: ChainId.MAINNET,
    tvlUSD: 64330,
    tvlETH: 17.26,
    comment: 'Bunni USD0-USD0++ Mainnet',
    feeTier: '0',
    tickSpacing: '5',
    hooks: '0x000052423c1db6b7ff8641b85a7eefc7b2791888',
    liquidity: '173747248900',
    token0: {
      id: '0x35d8949372d46b7a3d5a56006ae77b215fc69bc0',
    },
    token1: {
      id: '0x73a15fed60bf67631dc6cd7bc5b6e8da8190acf5',
    },
  },
  // ETH-USDC #289 Base
  {
    id: '0xbb10cb59b736ab186d8a17d8459bf93503cf820f701884e0154c429057bd7227',
    chainId: ChainId.BASE,
    tvlUSD: 54780,
    tvlETH: 14.69,
    comment: 'ETH-USDC #289 Base',
    feeTier: '0',
    tickSpacing: '5',
    hooks: '0x000052423c1db6b7ff8641b85a7eefc7b2791888',
    liquidity: '173747248900',
    token0: {
      id: '0x0000000000000000000000000000000000000000',
    },
    token1: {
      id: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    },
  },
  // hwHLP-USDT #95 Mainnet
  {
    id: '0x896895226e2cde763d53496363ef5af1d6d60f0df7960d658c1d0c6251db6c66',
    chainId: ChainId.MAINNET,
    tvlUSD: 49540,
    tvlETH: 13.29,
    comment: 'hwHLP-USDT #95 Mainnet',
    feeTier: '0',
    tickSpacing: '10',
    hooks: '0x000052423c1db6b7ff8641b85a7eefc7b2791888',
    liquidity: '173747248900',
    token0: {
      id: '0x9fd7466f987fd4c45a5bbde22ed8aba5bc8d72d1',
    },
    token1: {
      id: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    },
  },
  // ETH-PRL #80 Mainnet
  {
    id: '0xbc472c63afae4d891699e56a0e1ce6b4c7b71a1830494c214a739de06c49384f',
    chainId: ChainId.MAINNET,
    tvlUSD: 42060,
    tvlETH: 11.28,
    comment: 'ETH-PRL #80 Mainnet',
    feeTier: '2',
    tickSpacing: '100',
    hooks: '0x000052423c1db6b7ff8641b85a7eefc7b2791888',
    liquidity: '173747248900',
    token0: {
      id: '0x0000000000000000000000000000000000000000',
    },
    token1: {
      id: '0x6c0aeceedc55c9d55d8b99216a670d85330941c3',
    },
  },
  // ETH-USDC #293 Base
  {
    id: '0x6dbb5d653f8e11f406adf38091138546f70bc352ccf1115983520d1fe4284449',
    chainId: ChainId.BASE,
    tvlUSD: 36290,
    tvlETH: 9.73,
    comment: 'ETH-USDC #293 Base',
    feeTier: '1',
    tickSpacing: '5',
    hooks: '0x000052423c1db6b7ff8641b85a7eefc7b2791888',
    liquidity: '173747248900',
    token0: {
      id: '0x0000000000000000000000000000000000000000',
    },
    token1: {
      id: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    },
  },
  // ETH-BUNNI #26 Base
  {
    id: '0xc3011ab27d607decdc04ab317585dececaa91de749be8b46accb36e066d8f420',
    chainId: ChainId.BASE,
    tvlUSD: 35070,
    tvlETH: 9.4,
    comment: 'ETH-BUNNI #26 Base',
    feeTier: '0',
    tickSpacing: '60',
    hooks: '0x0010d0d5db05933fa0d9f7038d365e1541a41888',
    liquidity: '173747248900',
    token0: {
      id: '0x0000000000000000000000000000000000000000',
    },
    token1: {
      id: '0x000000c396558ffbab5ea628f39658bdf61345b3',
    },
  },
  // ETH-USDC #62 Unichain
  {
    id: '0x39bd03115d5482eefbf43b1f3f3c48188f32bcb09b43fd4722f4c86d399e282a',
    chainId: ChainId.UNICHAIN,
    tvlUSD: 34950,
    tvlETH: 9.37,
    comment: 'ETH-USDC #62 Unichain',
    feeTier: '0',
    tickSpacing: '5',
    hooks: '0x000052423c1db6b7ff8641b85a7eefc7b2791888',
    liquidity: '173747248900',
    token0: {
      id: '0x0000000000000000000000000000000000000000',
    },
    token1: {
      id: '0x078d782b760474a361dda0af3839290b0ef57ad6',
    },
  },
  // ETH-BUNNI #12 Arbitrum
  {
    id: '0xc3011ab27d607decdc04ab317585dececaa91de749be8b46accb36e066d8f420',
    chainId: ChainId.ARBITRUM_ONE,
    tvlUSD: 30760,
    tvlETH: 8.25,
    comment: 'ETH-BUNNI #12 Arbitrum',
    feeTier: '0',
    tickSpacing: '60',
    hooks: '0x0010d0d5db05933fa0d9f7038d365e1541a41888',
    liquidity: '173747248900',
    token0: {
      id: '0x0000000000000000000000000000000000000000',
    },
    token1: {
      id: '0x000000c396558ffbab5ea628f39658bdf61345b3',
    },
  },
  // BUNNI-USDC #33 Mainnet
  {
    id: '0x00ef227c44fdb9dead9e5249abacfd8236ff375e84f6578e4c64743643a90447',
    chainId: ChainId.MAINNET,
    tvlUSD: 22940,
    tvlETH: 6.15,
    comment: 'BUNNI-USDC #33 Mainnet',
    feeTier: '0',
    tickSpacing: '60',
    hooks: '0x0000fe59823933ac763611a69c88f91d45f81888',
    liquidity: '173747248900',
    token0: {
      id: '0x000000c396558ffbab5ea628f39658bdf61345b3',
    },
    token1: {
      id: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    },
  },
  // ETH-USDC #272 Base
  {
    id: '0x153695fdc96c0a3152b166ed2183c61268bb94e81aa21f1fde4304e277c49755',
    chainId: ChainId.BASE,
    tvlUSD: 19060,
    tvlETH: 5.11,
    comment: 'ETH-USDC #272 Base',
    feeTier: '1',
    tickSpacing: '10',
    hooks: '0x000052423c1db6b7ff8641b85a7eefc7b2791888',
    liquidity: '173747248900',
    token0: {
      id: '0x0000000000000000000000000000000000000000',
    },
    token1: {
      id: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    },
  },
  // ETH-USDC #294 Base
  {
    id: '0xdea704e5d90cec9defc31ce88a1d06033fd7a02297fd5852ac103027e30134cb',
    chainId: ChainId.BASE,
    tvlUSD: 16510,
    tvlETH: 4.43,
    comment: 'ETH-USDC #294 Base',
    feeTier: '2',
    tickSpacing: '5',
    hooks: '0x000052423c1db6b7ff8641b85a7eefc7b2791888',
    liquidity: '173747248900',
    token0: {
      id: '0x0000000000000000000000000000000000000000',
    },
    token1: {
      id: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    },
  },
  // ETH-USDC #237 Base
  {
    id: '0x471931205b39f65dcf1c063761c098f7b29237af4059533e246a3545929156ed',
    chainId: ChainId.BASE,
    tvlUSD: 14910,
    tvlETH: 3.998,
    comment: 'ETH-USDC #237 Base',
    feeTier: '11',
    tickSpacing: '100',
    hooks: '0x000052423c1db6b7ff8641b85a7eefc7b2791888',
    liquidity: '173747248900',
    token0: {
      id: '0x0000000000000000000000000000000000000000',
    },
    token1: {
      id: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    },
  },
  // ETH-USDC #93 Mainnet
  {
    id: '0x60a57df13fb84af43e06a2ed44a8800e6e693e0ef9a648cac5755feb58cab1ec',
    chainId: ChainId.MAINNET,
    tvlUSD: 13020,
    tvlETH: 3.49,
    comment: 'ETH-USDC #93 Mainnet',
    feeTier: '0',
    tickSpacing: '20',
    hooks: '0x000052423c1db6b7ff8641b85a7eefc7b2791888',
    liquidity: '173747248900',
    token0: {
      id: '0x0000000000000000000000000000000000000000',
    },
    token1: {
      id: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    },
  },
  // ETH-DOT #238 Base
  {
    id: '0xec8d8d7c033f92492ab5c18272bae93324d12a5c452db1e2da0c63deb9e24dcd',
    chainId: ChainId.BASE,
    tvlUSD: 11620,
    tvlETH: 3.116,
    comment: 'ETH-DOT #238 Base',
    feeTier: '0',
    tickSpacing: '60',
    hooks: '0x000052423c1db6b7ff8641b85a7eefc7b2791888',
    liquidity: '173747248900',
    token0: {
      id: '0x0000000000000000000000000000000000000000',
    },
    token1: {
      id: '0x8d010bf9c26881788b4e6bf5fd1bdc358c8f90b8',
    },
  },
  // ETH-USDC #63 Unichain
  {
    id: '0xe7154d81104dc9ff8aec461c020a8cdb2cbbb0bfb910454ee020e5f43748ca6f',
    chainId: ChainId.UNICHAIN,
    tvlUSD: 11520,
    tvlETH: 3.09,
    comment: 'ETH-USDC #63 Unichain',
    feeTier: '1',
    tickSpacing: '5',
    hooks: '0x000052423c1db6b7ff8641b85a7eefc7b2791888',
    liquidity: '173747248900',
    token0: {
      id: '0x0000000000000000000000000000000000000000',
    },
    token1: {
      id: '0x078d782b760474a361dda0af3839290b0ef57ad6',
    },
  },
  // ETH-USDC #52 Unichain
  {
    id: '0xe0326777ba1df8f4b5c522b58a669910e78efb1aa5596741dc224b4ac4ac1105',
    chainId: ChainId.UNICHAIN,
    tvlUSD: 10780,
    tvlETH: 2.89,
    comment: 'ETH-USDC #52 Unichain',
    feeTier: '1',
    tickSpacing: '15',
    hooks: '0x000052423c1db6b7ff8641b85a7eefc7b2791888',
    liquidity: '173747248900',
    token0: {
      id: '0x0000000000000000000000000000000000000000',
    },
    token1: {
      id: '0x078d782b760474a361dda0af3839290b0ef57ad6',
    },
  },
  // ETH-DOT #82 Mainnet
  {
    id: '0xec8d8d7c033f92492ab5c18272bae93324d12a5c452db1e2da0c63deb9e24dcd',
    chainId: ChainId.MAINNET,
    tvlUSD: 10610,
    tvlETH: 2.845,
    comment: 'ETH-DOT #82 Mainnet',
    feeTier: '0',
    tickSpacing: '60',
    hooks: '0x000052423c1db6b7ff8641b85a7eefc7b2791888',
    liquidity: '173747248900',
    token0: {
      id: '0x0000000000000000000000000000000000000000',
    },
    token1: {
      id: '0x8d010bf9c26881788b4e6bf5fd1bdc358c8f90b8',
    },
  },
  // ETH-USDC #97 Mainnet
  {
    id: '0xc50a93437d1519f973138b2969583871bea0a6a9840d192c612d3cdd767fa70c',
    chainId: ChainId.MAINNET,
    tvlUSD: 10310,
    tvlETH: 2.76,
    comment: 'ETH-USDC #97 Mainnet',
    feeTier: '0',
    tickSpacing: '5',
    hooks: '0x000052423c1db6b7ff8641b85a7eefc7b2791888',
    liquidity: '173747248900',
    token0: {
      id: '0x0000000000000000000000000000000000000000',
    },
    token1: {
      id: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    },
  },
  // USDC-USN #81 Mainnet
  {
    id: '0x5195b3bf1daf25337b0db638c9c7dee112c9e4ddad39e9d7a1e706ba36183e73',
    chainId: ChainId.MAINNET,
    tvlUSD: 10070,
    tvlETH: 2.7,
    comment: 'USDC-USN #81 Mainnet',
    feeTier: '0',
    tickSpacing: '10',
    hooks: '0x000052423c1db6b7ff8641b85a7eefc7b2791888',
    liquidity: '173747248900',
    token0: {
      id: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    },
    token1: {
      id: '0xda67b4284609d2d48e5d10cfac411572727dc1ed',
    },
  },
  // ETH-USDC #247 Base
  {
    id: '0xe321dcdee0324032c55436c4ca2a41719c9e3bed1ac3e06e64a52952a73f41bd',
    chainId: ChainId.BASE,
    tvlUSD: 9770,
    tvlETH: 2.62,
    comment: 'ETH-USDC #247 Base',
    feeTier: '4',
    tickSpacing: '60',
    hooks: '0x000052423c1db6b7ff8641b85a7eefc7b2791888',
    liquidity: '173747248900',
    token0: {
      id: '0x0000000000000000000000000000000000000000',
    },
    token1: {
      id: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    },
  },
  // ETH-BETS #43 Base
  {
    id: '0xa9f6c9c09120188ce8ec833bbe87b702a5b61996e970138040acf8066334bc19',
    chainId: ChainId.BASE,
    tvlUSD: 6820,
    tvlETH: 1.83,
    comment: 'ETH-BETS #43 Base',
    feeTier: '0',
    tickSpacing: '100',
    hooks: '0x0000fe59823933ac763611a69c88f91d45f81888',
    liquidity: '173747248900',
    token0: {
      id: '0x0000000000000000000000000000000000000000',
    },
    token1: {
      id: '0x94025780a1ab58868d9b2dbbb775f44b32e8e6e5',
    },
  },
  // ETH-USDC #287 Base
  {
    id: '0x8603a8a4283333cd5d12e657e77394f27c1c877b32ee00f644d7d6e76d229a6e',
    chainId: ChainId.BASE,
    tvlUSD: 6140,
    tvlETH: 1.65,
    comment: 'ETH-USDC #287 Base',
    feeTier: '0',
    tickSpacing: '40',
    hooks: '0x000052423c1db6b7ff8641b85a7eefc7b2791888',
    liquidity: '173747248900',
    token0: {
      id: '0x0000000000000000000000000000000000000000',
    },
    token1: {
      id: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    },
  },
  // ETH-DOT #42 Arbitrum
  {
    id: '0x1462eda3ab4d44cd593c3e22e323bbf7058dabdc84a8d6cc8bdfb2428bd77547',
    chainId: ChainId.ARBITRUM_ONE,
    tvlUSD: 6090,
    tvlETH: 1.633,
    comment: 'ETH-DOT #42 Arbitrum',
    feeTier: '0',
    tickSpacing: '60',
    hooks: '0x0000eb22c45bdb564f985ace0b4d05a64fa71888',
    liquidity: '173747248900',
    token0: {
      id: '0x0000000000000000000000000000000000000000',
    },
    token1: {
      id: '0x8d010bf9c26881788b4e6bf5fd1bdc358c8f90b8',
    },
  },
  // WETH-DOT #5 BSC
  {
    id: '0x48323603dde908bfbd512c4c723e28ea9c7ee7f5558f7bcc9cafa798c039b9bd',
    chainId: ChainId.BNB,
    tvlUSD: 5220,
    tvlETH: 1.4,
    comment: 'WETH-DOT #5 BSC',
    feeTier: '0',
    tickSpacing: '60',
    hooks: '0x000052423c1db6b7ff8641b85a7eefc7b2791888',
    liquidity: '173747248900',
    token0: {
      id: '0x2170ed0880ac9a755fd29b2688956bd959f933f8',
    },
    token1: {
      id: '0x8d010bf9c26881788b4e6bf5fd1bdc358c8f90b8',
    },
  },
  // ETH-weETH 1.0 Base
  {
    id: '0xa7654bd36dd1ea5da2a6a93adc36a6ddf1b0430039ed10ec655a5ab06fc0d2a3',
    chainId: ChainId.BASE,
    tvlUSD: 5220,
    tvlETH: 1.4,
    comment: 'ETH-weETH 1.0 Base',
    feeTier: '0',
    tickSpacing: '10',
    hooks: '0x0010d0d5db05933fa0d9f7038d365e1541a41888',
    liquidity: '173747248900',
    token0: {
      id: '0x0000000000000000000000000000000000000000',
    },
    token1: {
      id: '0x04c0599ae5a44757c0af6f9ec3b93da8976c150a',
    },
  },
  // ETH-wstETH 1.0 Base
  {
    id: '0x18851334c1315b5c92d577e50f3190e599ab6f7460b7859add5473f922c3bf54',
    chainId: ChainId.BASE,
    tvlUSD: 3720,
    tvlETH: 0.998,
    comment: 'ETH-wstETH 1.0 Base',
    feeTier: '0',
    tickSpacing: '10',
    hooks: '0x0010d0d5db05933fa0d9f7038d365e1541a41888',
    liquidity: '173747248900',
    token0: {
      id: '0x0000000000000000000000000000000000000000',
    },
    token1: {
      id: '0xc1cba3fcea344f92d9239c08c0568f6f2f0ee452',
    },
  },
  // Bunni ETH-ezETH Unichain
  {
    id: '0x10489138471e08ab1b1be7c2130253b18f61a1bfad6ca827199296088c6e90d6',
    chainId: ChainId.UNICHAIN,
    tvlUSD: 3100,
    tvlETH: 0.831,
    comment: 'Bunni ETH-ezETH Unichain',
    feeTier: '0',
    tickSpacing: '10',
    hooks: '0x000052423c1db6b7ff8641b85a7eefc7b2791888',
    liquidity: '173747248900',
    token0: {
      id: '0x0000000000000000000000000000000000000000',
    },
    token1: {
      id: '0x2416092f143378750bb29b79ed961ab195cceea5',
    },
  },
  // ETH-USDC #250 Base
  {
    id: '0x00d3f91dafdb3ebcf6df83e44542cd2db299518d582efa1e4f6ff2fed2a28bff',
    chainId: ChainId.BASE,
    tvlUSD: 2960,
    tvlETH: 0.794,
    comment: 'ETH-USDC #250 Base',
    feeTier: '0',
    tickSpacing: '15',
    hooks: '0x000052423c1db6b7ff8641b85a7eefc7b2791888',
    liquidity: '173747248900',
    token0: {
      id: '0x0000000000000000000000000000000000000000',
    },
    token1: {
      id: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    },
  },
  // ETH-BUNNI #2 Mainnet
  {
    id: '0x6fbd7ab3e52fea2a986a24990db57b8a5a90c8769bfd9cbc0c276541fcb73e53',
    chainId: ChainId.MAINNET,
    tvlUSD: 2760,
    tvlETH: 0.74,
    comment: 'ETH-BUNNI #2 Mainnet',
    feeTier: '0',
    tickSpacing: '100',
    hooks: '0x0010d0d5db05933fa0d9f7038d365e1541a41888',
    liquidity: '173747248900',
    token0: {
      id: '0x0000000000000000000000000000000000000000',
    },
    token1: {
      id: '0x000000c396558ffbab5ea628f39658bdf61345b3',
    },
  },
  // USD0-USDC #75 Mainnet
  {
    id: '0xc2830c07fd4e4e3f50006c0663d881b082c97536c3898d65094da7f71162ab1b',
    chainId: ChainId.MAINNET,
    tvlUSD: 2640,
    tvlETH: 0.708,
    comment: 'USD0-USDC #75 Mainnet',
    feeTier: '0',
    tickSpacing: '10',
    hooks: '0x000052423c1db6b7ff8641b85a7eefc7b2791888',
    liquidity: '173747248900',
    token0: {
      id: '0x73a15fed60bf67631dc6cd7bc5b6e8da8190acf5',
    },
    token1: {
      id: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    },
  },
  // cbBTC-LBTC #1 Base
  {
    id: '0x037fdf1d5fff3a80e2bbc6855ce5a3741c09e10d0adc5b32bcbd19a5bd25763a',
    chainId: ChainId.BASE,
    tvlUSD: 2530,
    tvlETH: 0.678,
    comment: 'cbBTC-LBTC #1 Base',
    feeTier: '0',
    tickSpacing: '10',
    hooks: '0x0010d0d5db05933fa0d9f7038d365e1541a41888',
    liquidity: '173747248900',
    token0: {
      id: '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf',
    },
    token1: {
      id: '0xecac9c5f704e954931349da37f60e39f515c11c1',
    },
  },
  // WETH-USDC #36 Base
  {
    id: '0x66fa569c8aa30894818043ff5e90656d8568208ee73c55cc812bdbb0b475fb71',
    chainId: ChainId.BASE,
    tvlUSD: 2490,
    tvlETH: 0.668,
    comment: 'WETH-USDC #36 Base',
    feeTier: '0',
    tickSpacing: '100',
    hooks: '0x0000fe59823933ac763611a69c88f91d45f81888',
    liquidity: '173747248900',
    token0: {
      id: '0x4200000000000000000000000000000000000006',
    },
    token1: {
      id: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    },
  },
  // ETH-USDbC #30 Base
  {
    id: '0x940823de67ee0ba27fbea781f96acca3f5500625a28511ac1a27b62b1bb280bc',
    chainId: ChainId.BASE,
    tvlUSD: 1920,
    tvlETH: 0.515,
    comment: 'ETH-USDbC #30 Base',
    feeTier: '0',
    tickSpacing: '100',
    hooks: '0x0010d0d5db05933fa0d9f7038d365e1541a41888',
    liquidity: '173747248900',
    token0: {
      id: '0x0000000000000000000000000000000000000000',
    },
    token1: {
      id: '0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca',
    },
  },
  // USDC-USDT #71 Arbitrum
  {
    id: '0xf409b4740b3a450fcd7b8657d4064846795b91bd456c802bed2fd5c88ca12a9c',
    chainId: ChainId.ARBITRUM_ONE,
    tvlUSD: 1860,
    tvlETH: 0.499,
    comment: 'USDC-USDT #71 Arbitrum',
    feeTier: '0',
    tickSpacing: '5',
    hooks: '0x0000eb22c45bdb564f985ace0b4d05a64fa71888',
    liquidity: '173747248900',
    token0: {
      id: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
    },
    token1: {
      id: '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9',
    },
  },
  // USDC-frxUSD #45 Mainnet
  {
    id: '0x690f92bc0598b82fa7dfea7cba108f54da349da46b22bc634795a9d34617b22c',
    chainId: ChainId.MAINNET,
    tvlUSD: 1110,
    tvlETH: 0.298,
    comment: 'USDC-frxUSD #45 Mainnet',
    feeTier: '0',
    tickSpacing: '2',
    hooks: '0x0000fe59823933ac763611a69c88f91d45f81888',
    liquidity: '173747248900',
    token0: {
      id: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    },
    token1: {
      id: '0xcacd6fd266af91b8aed52accc382b4e165586e29',
    },
  },
  // USDT/USDC
  {
    id: '0xfcb95f2277ef9524fb6a2e2c38209a7a3b955c34c933d2cdb570c1e9240fc475',
    chainId: ChainId.MAINNET,
    tvlUSD: 800000,
    tvlETH: 400,
    comment: 'USDT/USDC',
    feeTier: '0',
    tickSpacing: '10',
    hooks: '0x0000fe59823933ac763611a69c88f91d45f81888',
    liquidity: '173747248900',
    token0: {
      id: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    },
    token1: {
      id: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    },
  },
  // Flagship ETH-USDC 1.1
  {
    id: '0x278ade56e33a097c673da54989ab41bc66d79d8362c38e7c7f2ae76a1d4e4e9f',
    chainId: ChainId.BASE,
    tvlUSD: 420000,
    tvlETH: 210,
    comment: 'Flagship ETH-USDC 1.1',
    feeTier: '1',
    tickSpacing: '60',
    hooks: '0x0000fe59823933ac763611a69c88f91d45f81888',
    liquidity: '173747248900',
    token0: {
      id: '0x0000000000000000000000000000000000000000',
    },
    token1: {
      id: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    },
  },
  // USDC-USDT 1.0
  {
    id: '0x52820f86a8b193cbb46184b990085535e5956003b0005569649125cc070d14d0',
    chainId: ChainId.ARBITRUM_ONE,
    tvlUSD: 70000,
    tvlETH: 210,
    comment: 'USDC-USDT 1.0',
    feeTier: '1',
    tickSpacing: '10',
    hooks: '0x0010d0d5db05933fa0d9f7038d365e1541a41888',
    liquidity: '173747248900',
    token0: {
      id: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
    },
    token1: {
      id: '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9',
    },
  },
  // ETH-wstETH 1.0
  {
    id: '0xccc788002cf655b20e41330bd9af113fd7df7cdebe68367574ea28cab1d59768',
    chainId: ChainId.MAINNET,
    tvlUSD: 800000,
    tvlETH: 400,
    comment: 'ETH-wstETH 1.0',
    feeTier: '0',
    tickSpacing: '10',
    hooks: '0x0010d0d5db05933fa0d9f7038d365e1541a41888',
    liquidity: '173747248900',
    token0: {
      id: '0x0000000000000000000000000000000000000000',
    },
    token1: {
      id: '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0',
    },
  },
  // ETH-wstETH 1.0
  {
    id: '0xcf3e20a072e6c74916da3e57086fa0f781ff54de4f060194e19aabf4dd94f55c',
    chainId: ChainId.ARBITRUM_ONE,
    tvlUSD: 600000,
    tvlETH: 300,
    comment: 'ETH-wstETH 1.0',
    feeTier: '0',
    tickSpacing: '10',
    hooks: '0x0010d0d5db05933fa0d9f7038d365e1541a41888',
    liquidity: '173747248900',
    token0: {
      id: '0x0000000000000000000000000000000000000000',
    },
    token1: {
      id: '0x5979d7b546e38e414f7e9822514be443a4800529',
    },
  }
]