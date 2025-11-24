import { ChainId } from '@uniswap/sdk-core'
import { ADDRESS_ZERO } from '@uniswap/router-sdk'

// all hook addresses need to be lower case, since the check in isHooksPoolRoutable assumes lower case
export const extraHooksAddressesOnSepolia = '0x0000000000000000000000000000000000000020'
export const ETH_FLETH_AUTO_WRAP_HOOKS_ADDRESS_ON_BASE = '0x9e433f32bb5481a9ca7dff5b3af74a7ed041a888'

// example pool: https://app.uniswap.org/explore/pools/base/0xf8f4afa64c443ff00630d089205140814c9c0ce79ff293d05913a161fcc7ec4a
export const FLAUNCH_POSM_V1_ON_BASE = '0x51bba15255406cfe7099a42183302640ba7dafdc'
export const FLAUNCH_POSM_V2_ON_BASE = '0xf785bb58059fab6fb19bdda2cb9078d9e546efdc'
export const FLAUNCH_POSM_V3_ON_BASE = '0xb903b0ab7bcee8f5e4d8c9b10a71aac7135d6fdc'
export const FLAUNCH_POSM_V4_ON_BASE = '0x23321f11a6d44fd1ab790044fdfde5758c902fdc'
export const FLAUNCH_ANYPOSM_V1_ON_BASE = '0x8dc3b85e1dc1c846ebf3971179a751896842e5dc'

export const GRADUATION_HOOKS_ADDRESS_ON_BASE = '0xc5a48b447f01e9ce3ede71e4c1c2038c38bd9000'
export const TWAMM_HOOKS_ADDRESS_ON_BASE = '0xed1698c29928a6c44cddb0c75ab0e5d47eb72a80'
export const COINBASE_VERIFIED_HOOKS_ADDRESS_ON_BASE = '0x5cd525c621afca515bf58631d4733fba7b72aae4'
export const BTC_ACC_ON_BASE = '0x704268ac7043aeef50f47b6a03ae68ccf808e044'

// https://linear.app/uniswap/issue/ROUTE-580/allowlist-slippagefeehook-on-arbitrum
// example pool: 0x582387e095a7fbcba58222b6f9f56cc3e6177d766d10dd0d96a70dab70f66be9
export const SLIPPAGE_FEE_HOOK_ON_ARBITRUM = '0xc4bf39a096a1b610dd6186935f3ad99c66239080'

// https://linear.app/uniswap/issue/ROUTE-555/allowlist-clanker-hook
export const CLANKER_DYNAMIC_FEE_HOOKS_ADDRESS_ON_BASE = '0x34a45c6b61876d739400bd71228cbcbd4f53e8cc'
export const CLANKER_STATIC_FEE_HOOKS_ADDRESS_ON_BASE = '0xdd5eeaff7bd481ad55db083062b13a3cdf0a68cc'
export const CLANKER_DYNAMIC_FEE_HOOKS_ADDRESS_ON_BASE_v2 = '0xd60d6b218116cfd801e28f78d011a203d2b068cc'
export const CLANKER_STATIC_FEE_HOOKS_ADDRESS_ON_BASE_v2 = '0xb429d62f8f3bffb98cdb9569533ea23bf0ba28cc'
// https://linear.app/uniswap/issue/ROUTE-591/allowlist-additional-clanker-hooks
export const CLANKER_DYNAMIC_FEE_HOOKS_ADDRESS_ON_ARBITRUM = '0xfd213be7883db36e1049dc42f5bd6a0ec66b68cc'
export const CLANKER_STATIC_FEE_HOOKS_ADDRESS_ON_ARBITRUM = '0xf7ac669593d2d9d01026fa5b756dd5b4f7aaa8cc'
export const CLANKER_DYNAMIC_FEE_HOOKS_ADDRESS_ON_UNICHAIN = '0x9b37a43422d7bbd4c8b231be11e50ad1ace828cc'
export const CLANKER_STATIC_FEE_HOOKS_ADDRESS_ON_UNICHAIN = '0xbc6e5abda425309c2534bc2bc92562f5419ce8cc'
export const CLANKER_STATIC_FEE_HOOKS_ADDRESS_ON_MAINNET = '0x6c24d0bcc264ef6a740754a11ca579b9d225e8cc'
export const CLANKER_STATIC_FEE_HOOKS_ADDRESS_ON_MONAD = '0x94F802a9EFE4dd542FdBd77a25D9e69A6dC828Cc'

export const WETH_HOOKS_ADDRESS_ON_OP_MAINNET = '0x480dafdb4d6092ef3217595b75784ec54b52e888'
export const WETH_HOOKS_ADDRESS_ON_UNICHAIN = '0x730b109bad65152c67ecc94eb8b0968603dba888'
export const WETH_HOOKS_ADDRESS_ON_BASE = '0xb08211d57032dd10b1974d4b876851a7f7596888'
export const WETH_HOOKS_ADDRESS_ON_MAINNET = '0x57991106cb7aa27e2771beda0d6522f68524a888'
export const WETH_HOOKS_ADDRESS_ON_MONAD = '0x3fad8a7205f943528915e67cf94fc792c8fce888'
export const WETH_HOOKS_ADDRESS_ON_ARBITRUM = '0x2a4adf825bd96598487dbb6b2d8d882a4eb86888'

// example pool: https://app.uniswap.org/explore/pools/unichain/0x7dbe9918ba991e7c2b078ec8ce882a060024a6126927cf66553a359e427f2f6a
export const RENZO_ON_UNICHAIN = '0x09dea99d714a3a19378e3d80d1ad22ca46085080'
// example pool: https://app.uniswap.org/explore/pools/unichain/0x0e3a702c43b613fe8c635e375ca4f0b8d4870526c1e6f795d379f0fb6041ed91
export const AEGIS_ON_UNICHAIN_V1 = '0x27bfccf7fdd8215ce5dd86c2a36651d05c8450cc'
// example pool: https://app.uniswap.org/explore/pools/unichain/0x410723c1949069324d0f6013dba28829c4a0562f7c81d0f7cb79ded668691e1f
export const AEGIS_ON_UNICHAIN_V2 = '0xa0b0d2d00fd544d8e0887f1a3cedd6e24baf10cc'
// example pool: https://app.uniswap.org/explore/pools/unichain/0xBF12F5E68B1E1B3060BFB39B79794A0D5C1A723C0879281132B54887F87F928D
export const AEGIS_ON_UNICHAIN_V3 = '0x88c9ff9fc0b22cca42265d3f1d1c2c39e41cdacc'

// example pool: https://app.uniswap.org/explore/pools/base/0xc42d1a19441f4d29e1e87533958cf0afe16c9cc6ef3e2ce5ff67c3f291555fa0
export const ZORA_CREATOR_HOOK_ON_BASE_v1 = '0xfbce3d80c659c765bc6c55e29e87d839c7609040'
export const ZORA_CREATOR_HOOK_ON_BASE_v1_0_0_1 = '0x854f820475b229b7805a386f758cfb285023d040'
export const ZORA_CREATOR_HOOK_ON_BASE_v1_1_1 = '0x9301690be9ac901de52c5ebff883862bbfc99040'
export const ZORA_CREATOR_HOOK_ON_BASE_v1_1_1_1 = '0x5e5d19d22c85a4aef7c1fdf25fb22a5a38f71040'
export const ZORA_CREATOR_HOOK_ON_BASE_v1_1_2 = '0xd61a675f8a0c67a73dc3b54fb7318b4d91409040'
export const ZORA_CREATOR_HOOK_ON_BASE_v2_2 = '0x8218fa8d7922e22aed3556a09d5a715f16ad5040'
export const ZORA_CREATOR_HOOK_ON_BASE_v2_2_1 = '0x1258e5f3c71ca9dce95ce734ba5759532e46d040'

// example pool: https://app.uniswap.org/explore/pools/base/0x36C114F3C641031C837427A8CE7BFCE351FFD6C0ED2F2241BE0F1079E79E3B06
export const ZORA_POST_HOOK_ON_BASE_v1 = '0xa1ebdd5ca6470bbd67114331387f2dda7bfad040'
export const ZORA_POST_HOOK_ON_BASE_v1_0_0_1 = '0xb030fd8c2f8576f8ab05cfbbe659285e7d7a1040'
export const ZORA_POST_HOOK_ON_BASE_v1_0_0_2 = '0xe61bdf0c9e665f02df20fede6dcef379cb751040'
export const ZORA_POST_HOOK_ON_BASE_v1_1_1 = '0x81542dc43aff247eff4a0ecefc286a2973ae1040'
export const ZORA_POST_HOOK_ON_BASE_v1_1_1_1 = '0x5bf219b3cc11e3f6dd8dc8fc89d7d1deb0431040'
export const ZORA_POST_HOOK_ON_BASE_v1_1_2 = '0x9ea932730a7787000042e34390b8e435dd839040'
export const ZORA_POST_HOOK_ON_BASE_v2_2 = '0xff74be9d3596ea7a33bb4983dd7906fb34135040'
export const ZORA_POST_HOOK_ON_BASE_v2_2_1 = '0x2b15a16b3ef024005ba899bb51764fcd58cf9040'
export const ZORA_POST_HOOK_ON_BASE_v2_3_0 = '0xc8d077444625eb300a427a6dfb2b1dbf9b159040'

// example pool: https://app.uniswap.org/explore/pools/base/0x9cd78cc37624a69c32bc554d98460f9290bde0a3067583afaa7ec8de0a753ee3
export const DOPPLER_HOOKS_ADDRESS_ON_BASE = '0x77bb2a8f1ab2a384918a4c090cd8ae82dc5078e0'
export const DOPPLER_HOOKS_ADDRESS_ON_MONAD = '0x580ca49389d83b019d07E17e99454f2F218e2dc0'

// LimitOrderHook addresses: https://linear.app/uniswap/issue/ROUTE-625
// example pool: https://app.uniswap.org/explore/pools/arbitrum/0x015537a47e3865bd59fa4b0feed5546f1b5d27660447dddcdf86808bce384d98
export const LIMIT_ORDER_HOOKS_ADDRESS_ON_ARBITRUM = '0xd73339564ac99f3e09b0ebc80603ff8b796500c0'
// example pool: https://app.uniswap.org/explore/pools/unichain/0x2289791ab3c4a90c741427c52ea9411ba13bf8184c0b7bae4fea26262f400357
export const LIMIT_ORDER_HOOKS_ADDRESS_ON_UNICHAIN = '0x2016c0e4f8bb1d6fea777dc791be919e2eda40c0'
// example pool: https://app.uniswap.org/explore/pools/base/0xdfb2536ba09a004b32db0a1a15f73676b5e356d831c4ea1e843cd9433b080ab6
export const LIMIT_ORDER_HOOKS_ADDRESS_ON_BASE = '0x9d11f9505ca92f4b6983c1285d1ac0aaff7ec0c0'

// example pool: https://app.uniswap.org/explore/pools/unichain/0x348860e4565d7e3eb53af800a8931b1465a7540cdb5fa7f4dfd1e4d0bb2aa7f8
export const PANOPTIC_ORACLE_HOOK_ON_UNICHAIN = '0x79330fe369c32a03e3b8516aff35b44706e39080'

// https://linear.app/uniswap/issue/ROUTE-757/allowlist-fey-finance-hook
export const FEY_ON_SEPOLIA = '0x932d55d7b86d27eedd0934503e49f5f362faa8cc'
export const FEY_ON_BASE = '0x5b409184204b86f708d3aebb3cad3f02835f68cc'

// example pool: https://app.uniswap.org/explore/pools/base/0x40d496321728c117bfe36498138a44dd4bfe54777093250cdf17095ebf11537e
export const PUBHOUSE_HOOK_ON_BASE = '0x4ab61d774b170d0610fdcc5559aae2c356c600c8'

// TokenWorks Hooks on Mainnet
// example pool: https://app.uniswap.org/explore/pools/ethereum/0xbdb0f9c31367485f85e691f638345f3de673a78effaff71ce34bc7ff1d54fddc
export const TOKENWORKS_HOOK_ON_MAINNET_1 = '0xfaaad5b731f52cdc9746f2414c823eca9b06e844'
// example pool: https://app.uniswap.org/explore/pools/ethereum/0xdaa6a16445812d9661eab80de42d8298417d5533b5a7cc4b9efc4a387413a4e1
export const TOKENWORKS_HOOK_ON_MAINNET_2 = '0xbd15e4d324f8d02479a5ff53b52ef4048a79e444'
// example pool: https://app.uniswap.org/explore/pools/ethereum/0x134060a0672f5df29449673c9b2de0dc0beed4cd5354e532f801f0a3258906f8
export const TOKENWORKS_HOOK_ON_MAINNET_3 = '0xd6a45df0c82c9a686ab1e58fb28d8fc0cf106444'
// example pool: https://app.uniswap.org/explore/pools/ethereum/0x29aceb9aea1d8f4f9ee40dfffb7e46285d69cd4e9b8999c08da265f27fd0f9a8
export const TOKENWORKS_HOOK_ON_MAINNET_4 = '0xe3c63a9813ac03be0e8618b627cb8170cfa468c4'
// example pool: https://app.uniswap.org/explore/pools/ethereum/0xb0214c79008d1d71816166fbe17c01884386ccfc5560ce8b3cbb7a15dba93dce
export const TOKENWORKS_HOOK_ON_MAINNET_5 = '0x5d8a61fa2ced43eeabffc00c85f705e3e08c28c4'

// example pool: https://app.uniswap.org/explore/pools/ethereum/0xeea2c1344c876f4c8d7545cba9ed8b199e124d6dc3e2063e3f90ba94e7b53093
export const ENS_WHEEL_HOOK_ON_MAINNET = '0xf13bdafb90c79f2201e2ce42010c8ef75fede8c4'

// we do not allow v4 pools with non-zero hook address to be routed through in the initial v4 launch.
// this is the ultimate safeguard in the routing subgraph pool cron job.
export const HOOKS_ADDRESSES_ALLOWLIST: { [chain in ChainId]: Array<string> } = {
  [ChainId.MAINNET]: [
    ADDRESS_ZERO,
    WETH_HOOKS_ADDRESS_ON_MAINNET,
    CLANKER_STATIC_FEE_HOOKS_ADDRESS_ON_MAINNET,
    TOKENWORKS_HOOK_ON_MAINNET_1,
    // Disable below 2 hooks for now as they cause sim failure: https://linear.app/uniswap/issue/ROUTE-736
    // TOKENWORKS_HOOK_ON_MAINNET_2,
    // TOKENWORKS_HOOK_ON_MAINNET_3,
    TOKENWORKS_HOOK_ON_MAINNET_4,
    TOKENWORKS_HOOK_ON_MAINNET_5,
    ENS_WHEEL_HOOK_ON_MAINNET,
  ],
  [ChainId.GOERLI]: [ADDRESS_ZERO],
  [ChainId.SEPOLIA]: [ADDRESS_ZERO, extraHooksAddressesOnSepolia, FEY_ON_SEPOLIA],
  [ChainId.OPTIMISM]: [ADDRESS_ZERO, WETH_HOOKS_ADDRESS_ON_OP_MAINNET],
  [ChainId.OPTIMISM_GOERLI]: [ADDRESS_ZERO],
  [ChainId.OPTIMISM_SEPOLIA]: [ADDRESS_ZERO],
  [ChainId.ARBITRUM_ONE]: [
    ADDRESS_ZERO,
    SLIPPAGE_FEE_HOOK_ON_ARBITRUM,
    CLANKER_DYNAMIC_FEE_HOOKS_ADDRESS_ON_ARBITRUM,
    CLANKER_STATIC_FEE_HOOKS_ADDRESS_ON_ARBITRUM,
    WETH_HOOKS_ADDRESS_ON_ARBITRUM,
    LIMIT_ORDER_HOOKS_ADDRESS_ON_ARBITRUM,
  ],
  [ChainId.ARBITRUM_GOERLI]: [ADDRESS_ZERO],
  [ChainId.ARBITRUM_SEPOLIA]: [ADDRESS_ZERO],
  [ChainId.POLYGON]: [ADDRESS_ZERO],
  [ChainId.POLYGON_MUMBAI]: [ADDRESS_ZERO],
  [ChainId.CELO]: [ADDRESS_ZERO],
  [ChainId.CELO_ALFAJORES]: [ADDRESS_ZERO],
  [ChainId.GNOSIS]: [ADDRESS_ZERO],
  [ChainId.MOONBEAM]: [ADDRESS_ZERO],
  [ChainId.BNB]: [ADDRESS_ZERO],
  [ChainId.AVALANCHE]: [ADDRESS_ZERO],
  [ChainId.BASE_GOERLI]: [ADDRESS_ZERO],
  [ChainId.BASE_SEPOLIA]: [ADDRESS_ZERO],
  [ChainId.BASE]: [
    ADDRESS_ZERO,
    FLAUNCH_POSM_V1_ON_BASE,
    FLAUNCH_POSM_V2_ON_BASE,
    FLAUNCH_POSM_V3_ON_BASE,
    FLAUNCH_POSM_V4_ON_BASE,
    FLAUNCH_ANYPOSM_V1_ON_BASE,
    ETH_FLETH_AUTO_WRAP_HOOKS_ADDRESS_ON_BASE,
    GRADUATION_HOOKS_ADDRESS_ON_BASE,
    TWAMM_HOOKS_ADDRESS_ON_BASE,
    COINBASE_VERIFIED_HOOKS_ADDRESS_ON_BASE,
    BTC_ACC_ON_BASE,
    CLANKER_DYNAMIC_FEE_HOOKS_ADDRESS_ON_BASE,
    CLANKER_STATIC_FEE_HOOKS_ADDRESS_ON_BASE,
    CLANKER_DYNAMIC_FEE_HOOKS_ADDRESS_ON_BASE_v2,
    CLANKER_STATIC_FEE_HOOKS_ADDRESS_ON_BASE_v2,
    WETH_HOOKS_ADDRESS_ON_BASE,
    DOPPLER_HOOKS_ADDRESS_ON_BASE,
    LIMIT_ORDER_HOOKS_ADDRESS_ON_BASE,
    ZORA_CREATOR_HOOK_ON_BASE_v1,
    ZORA_CREATOR_HOOK_ON_BASE_v1_0_0_1,
    ZORA_CREATOR_HOOK_ON_BASE_v1_1_1,
    ZORA_CREATOR_HOOK_ON_BASE_v1_1_1_1,
    ZORA_CREATOR_HOOK_ON_BASE_v1_1_2,
    ZORA_CREATOR_HOOK_ON_BASE_v2_2,
    ZORA_CREATOR_HOOK_ON_BASE_v2_2_1,
    ZORA_POST_HOOK_ON_BASE_v1,
    ZORA_POST_HOOK_ON_BASE_v1_0_0_1,
    ZORA_POST_HOOK_ON_BASE_v1_0_0_2,
    ZORA_POST_HOOK_ON_BASE_v1_1_1,
    ZORA_POST_HOOK_ON_BASE_v1_1_1_1,
    ZORA_POST_HOOK_ON_BASE_v1_1_2,
    ZORA_POST_HOOK_ON_BASE_v2_2,
    ZORA_POST_HOOK_ON_BASE_v2_2_1,
    ZORA_POST_HOOK_ON_BASE_v2_3_0,
    FEY_ON_BASE,
    PUBHOUSE_HOOK_ON_BASE,
  ],
  [ChainId.ZORA]: [ADDRESS_ZERO],
  [ChainId.ZORA_SEPOLIA]: [ADDRESS_ZERO],
  [ChainId.ROOTSTOCK]: [ADDRESS_ZERO],
  [ChainId.BLAST]: [ADDRESS_ZERO],
  [ChainId.ZKSYNC]: [ADDRESS_ZERO],
  [ChainId.WORLDCHAIN]: [ADDRESS_ZERO],
  [ChainId.UNICHAIN_SEPOLIA]: [ADDRESS_ZERO],
  [ChainId.UNICHAIN]: [
    ADDRESS_ZERO,
    RENZO_ON_UNICHAIN,
    AEGIS_ON_UNICHAIN_V1,
    AEGIS_ON_UNICHAIN_V2,
    AEGIS_ON_UNICHAIN_V3,
    WETH_HOOKS_ADDRESS_ON_UNICHAIN,
    CLANKER_DYNAMIC_FEE_HOOKS_ADDRESS_ON_UNICHAIN,
    CLANKER_STATIC_FEE_HOOKS_ADDRESS_ON_UNICHAIN,
    LIMIT_ORDER_HOOKS_ADDRESS_ON_UNICHAIN,
    PANOPTIC_ORACLE_HOOK_ON_UNICHAIN,
  ],
  [ChainId.MONAD_TESTNET]: [ADDRESS_ZERO],
  [ChainId.MONAD]: [
    ADDRESS_ZERO,
    WETH_HOOKS_ADDRESS_ON_MONAD,
    CLANKER_STATIC_FEE_HOOKS_ADDRESS_ON_MONAD,
    DOPPLER_HOOKS_ADDRESS_ON_MONAD,
  ],
  [ChainId.SONEIUM]: [ADDRESS_ZERO],
}
