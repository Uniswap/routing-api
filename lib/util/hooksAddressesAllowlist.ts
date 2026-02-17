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
export const AEGIS_V3 = '0x88c9ff9fc0b22cca42265d3f1d1c2c39e41cdacc'

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
export const ZORA_POST_HOOK_ON_BASE_v2_4_0 = '0xf6d0a13609bb5779bc5d639f2ba3bfda83d4d0c0'

// example pool: https://app.uniswap.org/explore/pools/base/0x9cd78cc37624a69c32bc554d98460f9290bde0a3067583afaa7ec8de0a753ee3
export const DOPPLER_HOOKS_ADDRESS_ON_BASE = '0x77bb2a8f1ab2a384918a4c090cd8ae82dc5078e0'
export const DOPPLER_HOOKS_ADDRESS_ON_BASE_V2 = '0xbb7784a4d481184283ed89619a3e3ed143e1adc0'
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

// V1 Punk Strategic Reserve Hooks on Mainnet
// example pool: https://app.uniswap.org/explore/pools/ethereum/0x1b7cc22f2c6593851dbb0d42ab89eb92d2e02a8ea4822d68ef899581f630c33c
export const STRATEGICRESERVE_HOOK_ON_MAINNET = '0x6e1babe41d708f6d46a89cda1ae46de95458e444'

// example pool: https://app.uniswap.org/explore/pools/ethereum/0xeea2c1344c876f4c8d7545cba9ed8b199e124d6dc3e2063e3f90ba94e7b53093
export const ENS_WHEEL_HOOK_ON_MAINNET = '0xf13bdafb90c79f2201e2ce42010c8ef75fede8c4'

// example pool: https://app.uniswap.org/explore/pools/monad/0xfb2e06638df93ad3080109c410714b0903213135ff6f5909b3a846764df0b801
export const CULT_FEE_HOOK_ADDRESS_ON_MONAD = '0x7A2524cE937F206844b9508EEc8f6486800a40CC'

// example pool: https://app.uniswap.org/explore/pools/base/0xab22898bde69271720124833eb07b8e7268f69cb833d33cb2442e57e8b57eea1
export const AQUINAS_HOOK_ADDRESS_ON_BASE = '0xd3c1f2174f37f88811f99b1b1b4c1356c0246000'

// example pool: https://app.uniswap.org/explore/pools/ethereum/0x389a26ef4a4634e55fc4e3ae2149c1cafdbc141af16057ab5fab962c2dca5221
export const ASTERIX_HOOK_ADDRESS_ON_MAINNET = '0xdad7ea85ff786b389a13f4714a56b1721b56c044'

export const AZTEC_HOOK_ADDRESS_ON_MAINNET = '0xd53006d1e3110fd319a79aeec4c527a0d265e080'

// example pool: https://app.uniswap.org/explore/pools/base/0x02aaacb8bf6a4c3c3a99d8de43fad01348e68e314b7773fb2df3edac065e0c4e
export const DELI_HOOK_ADDRESS_ON_BASE = '0x570a48f96035c2874de1c0f13c5075a05683b0cc'
// example pool: https://app.uniswap.org/explore/pools/base/0xa900d06df8073e50a50971720d6d3470d00e64198da3b03c82388f247e0d13c1
export const DELI_HOOK_CONSTANT_PRODUCT_ON_BASE = '0x95afbc0fccf974b41380f24e562f15b6dd90fac8'

// example pool: https://app.uniswap.org/explore/pools/optimism/0xa30abc0ccd08c0c16d28ccfaf15de692a1778775de9f6dea337fb9b490163b18
export const FINDEX_HOOK_ON_OPTIMISM = '0xb35297543d357ef62df204d8c3bd0e96038cf440'

// example pool: https://app.uniswap.org/explore/pools/ethereum/0x26b73e77f7b2cfc05d28a8978b917eced1cdf7915862292cfbb507731d5120fd
export const ACTION_HOOK_ON_MAINNET = '0x00bbc6fc07342cf80d14b60695cf0e1aa8de00cc'

// example pool: https://app.uniswap.org/explore/pools/ethereum/0x4de849063d9559a699e26463a433c6d29e7570de49209f95295529afee20eb05
export const M0_ALLOWLIST_HOOKS_ADDRESS_ON_MAINNET = '0xaf53cb78035a8e0acce38441793e2648b15b88a0'

// example pool: https://app.uniswap.org/explore/pools/ethereum/0x6b3403809baa251f186c546908d6ebdbd5dc52527b2b3f8bc7d4f5a437091b0f
export const M0_TICK_RANGE_HOOKS_ADDRESS_ON_MAINNET = '0xde400595199e6dae55a1bcb742b3eb249af00800'

// example pool: https://app.uniswap.org/explore/pools/unichain/0x087de24dbfcd8c833dc54b73e3963451d315b7fda506dff0e45e5938e894dfbd
export const UNIDERP_HOOK_ON_UNICHAIN = '0xcc2efb167503f2d7df0eae906600066aec9e8444'

// example pool: https://app.uniswap.org/explore/pools/base/0xa113103448f7b09199e019656f377988c87f8f312ddcebc6fea9e78bcd6ec2af
export const SUPERSTRATEGY_HOOK_ON_BASE = '0x1e0c810a30fb82391df936602c1161421381b0c8'
// example pool: https://app.uniswap.org/explore/pools/base/0xe4821b1cbfce1906c2249d1b34366610960c01fa3f762b0579c594d2033b9152
export const WASSBLASTER_HOOK_ON_BASE = '0x35b9b5b023897da8c7375ba6141245b8416460cc'

// example pool: https://app.uniswap.org/explore/pools/base/0x3cdfb68e7c413e3ae9e5822ca428975a334d062388b2e3a0d42dc329880cbf36
export const SIMPLE_SELL_TAX_HOOK_ON_BASE = '0xca975b9daf772c71161f3648437c3616e5be0088'

// example pool: https://app.uniswap.org/explore/pools/ethereum/0x7a5a8f5a36a6a2e9961caf6bb047a5a7580d0fe16a532aad93efc596028dfa54
export const RING_FEW_ETH_HOOK_ON_MAINNET = '0x044301939deb7ca53c4733dd4d9b3bc5ea0c6888'
// example pool: https://app.uniswap.org/explore/pools/ethereum/0x301d41ff23b73b209ab2b1112f4effd0d8ff978ec29d743c1431463f84cbec24
export const RING_FEW_UNI_HOOK_ON_MAINNET = '0x4b3e2a8cf36c7eb0fba2a5b39b20c896c6f22888'
// example pool: https://app.uniswap.org/explore/pools/ethereum/0x18605c7a76101aeccc414cc300dd5e5ae44b30d6c247ba164ccd88952c259735
export const RING_FEW_WBTC_HOOK_ON_MAINNET = '0x0fe942afdb2f51e25cbf892aad175c6a574f2888'
// example pool: https://app.uniswap.org/explore/pools/ethereum/0x8f8b0b21fb429ffb5210f2bf0f8b7cb267b944a0c61beaae35f20f6839c0f33b
export const RING_FEW_CBBTC_HOOK_ON_MAINNET = '0x8347b7a3807c681513d2b51b8223e59aa16a2888'
// example pool: https://app.uniswap.org/explore/pools/ethereum/0x5837e6b4fd4b8193f2f7a8b4490c0f154344bb9a52b36a885578ff6d3193fc47
export const RING_FEW_USDC_HOOK_ON_MAINNET = '0x4b2eb653d13e6c9ac5a0a01fde22f2c8d6592888'
// example pool: https://app.uniswap.org/explore/pools/ethereum/0x7db868544c8f7f6ddb107c7749c94f03c9e0155f2138aef3f8a020e4a469d95a
export const RING_FEW_USDT_HOOK_ON_MAINNET = '0xbadf77d50478b4432ef1f243b9c0bc7869486888'
// example pool: https://app.uniswap.org/explore/pools/ethereum/0xf906beb74154ca4d057b7079c90eb1044efaf40ef468e62ec983930cf80a1e2b
export const RING_FEW_DAI_HOOK_ON_MAINNET = '0x85b648a64aed6307d5d5ce26e6ae086c17bde888'
// example pool: https://app.uniswap.org/explore/pools/ethereum/0x6933dfbf7441cc4ee4439843fdd464e215a6c90f07c5a769198e2a047f1f3f3e
export const RING_FEW_WEETH_HOOK_ON_MAINNET = '0x877323adbf747f85eb8d182d42f01f34a5492888'
// example pool: https://app.uniswap.org/explore/pools/ethereum/0xe7c2f30fd89238331b0e3e6ac6351578d5e3091b7839eff321c29cf88e17274e
export const RING_FEW_WSTETH_HOOK_ON_MAINNET = '0x75ae0292e8ad3ab60b9a1a7b3046d3f4abdfa888'
// example pool BSC: https://app.uniswap.org/explore/pools/bnb/0x085182518e82062e732fcb912becdf7140b42f8da31c7afd850db3c6d4309c8a
export const BVCC_DYNAMIC_FEE_HOOK_ON_BSC = '0x8a36d8408f5285c3f81509947bc187b3c0efd0c4'
export const BVCC_DYNAMIC_FEE_HOOK_ON_MAINNET = '0xf9ced7d0f5292af02385410eda5b7570b10b50c4'
export const BVCC_DYNAMIC_FEE_HOOK_ON_ARBITRUM = '0x2097d7329389264a1542ad50802bb0de84a650c4'
export const BVCC_DYNAMIC_FEE_HOOK_ON_BASE = '0x2c56c1302b6224b2bb1906c46f554622e12f10c4'

// example pool: https://app.uniswap.org/explore/pools/ethereum/0x95caa20ff578db4ceec56162bedc21e31adc70ef717661e11d6d1d74e9b2f844
export const MEME_STRATEGY_HOOK_ON_MAINNET = '0x3ba779bad405d9b68a7a7a86ff6916c806a200cc'

// example pool: https://app.uniswap.org/explore/pools/base/0x6f104dafea59868dfee9883a56d666393633115c2fda5dca6da4aa6e39f18e2f
export const FARSTR_HOOKS_ADDRESS_ON_BASE = '0xc3b8e77ac038aa260035a1911827086c34a9e844'

// example pool: https://app.uniswap.org/explore/pools/unichain/0x03f7cea23a0c6f2bbbaca94eeaf292290d9a4950e3f806495683a9fb1a941faf
export const UNIVERSAL_HOOK_ON_UNICHAIN = '0xcdfcab084b2d29025772141d3bf473bd9673aaa8'
// example pool: https://app.uniswap.org/explore/pools/avalanche/0xc09399b17e189ba3528aa516eb4f9c134720316bc7b3b5f8003c3967ec11f7cd
export const AVAXSTRATEGIES_STATIC_FEE_HOOKS_ADDRESS_ON_AVAX = '0x3b48f794a1d67febe95f66b6dff38c0a7e934044'

// example pool: https://app.uniswap.org/explore/pools/base/0x796b074977701c1156e7fc95d84dfa739963f2de33af8b61c2b7ad5b7018e0e9
export const ARTACLE_INDEX_TOKEN_HOOK_ON_BASE = '0xd577f945b6025ce1e60ac1a82f2ee8ff3fb428c4'

// example pool: https://app.uniswap.org/explore/pools/ethereum/0x0c1b00338ecfc1f4894a309420c2d8d654e500036268dd251b99decc66bd2b51
export const TOKEN_FLOW_TAX_HOOK_ON_MAINNET = '0x74803bd586fa5ce3a9ab38b49a7ca633af8700cc'

// example pool: https://app.uniswap.org/explore/pools/base/0xe6b8b2f7320759927c826e663ba1a77eaf8156bad1422234d5282c17c5e8f637
export const GPO_HOOKS = '0x6cabe2fd9fb60c5afcab7de732b0a224fc382eec'
// example pool: https://app.uniswap.org/explore/pools/base/0xe6b8b2f7320759927c826e663ba1a77eaf8156bad1422234d5282c17c5e8f637
export const GPX_HOOKS = '0x4519e2b040ff1b64fa03abe2aef0bc99d7cceaa8'

// example pool: https://app.uniswap.org/explore/pools/base/0xD532BF016A98A1329B83507B376493B0AEBEF85C89AAF6B505A7070ECDD63CDF
export const LIQUID_LAUNCH_HOOK_ON_BASE = '0xea9346e83952840e69beb36df365c4e68de0e080'

// example pool: https://app.uniswap.org/explore/pools/base/0x20aab1b33d63b7d6fc95deed43dfdf986a23a2d82857025533d2c18e2fef9e4b
export const ARRAKIS_PRIVATE_HOOK_ON_BASE = '0xf9527fb5a34ac6fbc579e4fbc3bf292ed57d4880'
// example pool: https://app.uniswap.org/explore/pools/ethereum/0x8679ef619b4ae7a464f8c208df1c49f294df41a237671d98882b50554c20a5c8
export const ARRAKIS_PRIVATE_HOOK_ON_MAINNET = '0xf9527fb5a34ac6fbc579e4fbc3bf292ed57d4880'

// example pool: https://app.uniswap.org/explore/pools/ethereum/0xe1b5535dda2fc16079a8bfaf408acec9ca7aca84e2e48c3715e51da6ec8051f6
export const CUSTOM_FEE_MEV_PROTECTION_HOOK_ON_MAINNET = '0xD5770936a6678353F1B17C342B29c4416B029080'

// example pool: https://app.uniswap.org/explore/pools/arbitrum/0xec6e37b2d66aa5ef5a9fc296b4da3474b121f512428dd425a51c6424955fc5eb
export const DORY_BURN_AND_MINT_POWER_HOOK_ON_ARBITRUM = '0x6b70fef40d3925881251c018164dBCEC6bc94040'

// example pool: https://app.uniswap.org/explore/pools/base/0xd2e486be751887088da2f4bf76a5872e0810d1bcaf43efec7d4bea3acbc3135a
export const BASEMEME_HOOK_ADDRESS_ON_BASE = '0x755776c51399f7ee15d47ddaf47347d26f5ca840'

// example pool: https://app.uniswap.org/explore/pools/base/0xaca93c6543498289affeab3b3645b0faa3c660d73d76a3d271c8b92339f88589
export const AI_PROTOCOL_SWAP_FEE_HOOK_V1_ON_BASE = '0x121f94835dab08ebaf084809a97e525b69e400cc'

export const CLAUNCH_HOOK_ON_BASE = '0x2f9354bbb0edef5c2a5c4b78d0c59d73412a28cc'

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
    STRATEGICRESERVE_HOOK_ON_MAINNET,
    ENS_WHEEL_HOOK_ON_MAINNET,
    ASTERIX_HOOK_ADDRESS_ON_MAINNET,
    ACTION_HOOK_ON_MAINNET,
    M0_ALLOWLIST_HOOKS_ADDRESS_ON_MAINNET,
    M0_TICK_RANGE_HOOKS_ADDRESS_ON_MAINNET,
    RING_FEW_ETH_HOOK_ON_MAINNET,
    RING_FEW_UNI_HOOK_ON_MAINNET,
    RING_FEW_WBTC_HOOK_ON_MAINNET,
    RING_FEW_CBBTC_HOOK_ON_MAINNET,
    RING_FEW_USDC_HOOK_ON_MAINNET,
    RING_FEW_USDT_HOOK_ON_MAINNET,
    RING_FEW_DAI_HOOK_ON_MAINNET,
    RING_FEW_WEETH_HOOK_ON_MAINNET,
    RING_FEW_WSTETH_HOOK_ON_MAINNET,
    MEME_STRATEGY_HOOK_ON_MAINNET,
    TOKEN_FLOW_TAX_HOOK_ON_MAINNET,
    ARRAKIS_PRIVATE_HOOK_ON_MAINNET,
    CUSTOM_FEE_MEV_PROTECTION_HOOK_ON_MAINNET,
    BVCC_DYNAMIC_FEE_HOOK_ON_MAINNET,
    AZTEC_HOOK_ADDRESS_ON_MAINNET,
  ],
  [ChainId.GOERLI]: [ADDRESS_ZERO],
  [ChainId.SEPOLIA]: [ADDRESS_ZERO, extraHooksAddressesOnSepolia, FEY_ON_SEPOLIA],
  [ChainId.OPTIMISM]: [ADDRESS_ZERO, WETH_HOOKS_ADDRESS_ON_OP_MAINNET, FINDEX_HOOK_ON_OPTIMISM],
  [ChainId.OPTIMISM_GOERLI]: [ADDRESS_ZERO],
  [ChainId.OPTIMISM_SEPOLIA]: [ADDRESS_ZERO],
  [ChainId.ARBITRUM_ONE]: [
    ADDRESS_ZERO,
    SLIPPAGE_FEE_HOOK_ON_ARBITRUM,
    CLANKER_DYNAMIC_FEE_HOOKS_ADDRESS_ON_ARBITRUM,
    CLANKER_STATIC_FEE_HOOKS_ADDRESS_ON_ARBITRUM,
    WETH_HOOKS_ADDRESS_ON_ARBITRUM,
    LIMIT_ORDER_HOOKS_ADDRESS_ON_ARBITRUM,
    DORY_BURN_AND_MINT_POWER_HOOK_ON_ARBITRUM,
    BVCC_DYNAMIC_FEE_HOOK_ON_ARBITRUM,
  ],
  [ChainId.ARBITRUM_GOERLI]: [ADDRESS_ZERO],
  [ChainId.ARBITRUM_SEPOLIA]: [ADDRESS_ZERO],
  [ChainId.POLYGON]: [ADDRESS_ZERO],
  [ChainId.POLYGON_MUMBAI]: [ADDRESS_ZERO],
  [ChainId.CELO]: [ADDRESS_ZERO],
  [ChainId.CELO_ALFAJORES]: [ADDRESS_ZERO],
  [ChainId.GNOSIS]: [ADDRESS_ZERO],
  [ChainId.MOONBEAM]: [ADDRESS_ZERO],
  [ChainId.BNB]: [ADDRESS_ZERO, BVCC_DYNAMIC_FEE_HOOK_ON_BSC],
  [ChainId.AVALANCHE]: [ADDRESS_ZERO, AVAXSTRATEGIES_STATIC_FEE_HOOKS_ADDRESS_ON_AVAX],
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
    DOPPLER_HOOKS_ADDRESS_ON_BASE_V2,
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
    ZORA_POST_HOOK_ON_BASE_v2_4_0,
    FEY_ON_BASE,
    PUBHOUSE_HOOK_ON_BASE,
    DELI_HOOK_ADDRESS_ON_BASE,
    DELI_HOOK_CONSTANT_PRODUCT_ON_BASE,
    AQUINAS_HOOK_ADDRESS_ON_BASE,
    SUPERSTRATEGY_HOOK_ON_BASE,
    SIMPLE_SELL_TAX_HOOK_ON_BASE,
    WASSBLASTER_HOOK_ON_BASE,
    BVCC_DYNAMIC_FEE_HOOK_ON_BASE,
    AEGIS_V3,
    FARSTR_HOOKS_ADDRESS_ON_BASE,
    ARTACLE_INDEX_TOKEN_HOOK_ON_BASE,
    GPO_HOOKS,
    GPX_HOOKS,
    ARRAKIS_PRIVATE_HOOK_ON_BASE,
    BASEMEME_HOOK_ADDRESS_ON_BASE,
    AI_PROTOCOL_SWAP_FEE_HOOK_V1_ON_BASE,
    LIQUID_LAUNCH_HOOK_ON_BASE,
    BVCC_DYNAMIC_FEE_HOOK_ON_BASE,
    CLAUNCH_HOOK_ON_BASE,
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
    AEGIS_V3,
    WETH_HOOKS_ADDRESS_ON_UNICHAIN,
    CLANKER_DYNAMIC_FEE_HOOKS_ADDRESS_ON_UNICHAIN,
    CLANKER_STATIC_FEE_HOOKS_ADDRESS_ON_UNICHAIN,
    LIMIT_ORDER_HOOKS_ADDRESS_ON_UNICHAIN,
    PANOPTIC_ORACLE_HOOK_ON_UNICHAIN,
    UNIDERP_HOOK_ON_UNICHAIN,
    UNIVERSAL_HOOK_ON_UNICHAIN,
  ],
  [ChainId.MONAD_TESTNET]: [ADDRESS_ZERO],
  [ChainId.MONAD]: [
    ADDRESS_ZERO,
    WETH_HOOKS_ADDRESS_ON_MONAD,
    CLANKER_STATIC_FEE_HOOKS_ADDRESS_ON_MONAD,
    DOPPLER_HOOKS_ADDRESS_ON_MONAD,
    CULT_FEE_HOOK_ADDRESS_ON_MONAD,
  ],
  [ChainId.SONEIUM]: [ADDRESS_ZERO],
  [ChainId.XLAYER]: [ADDRESS_ZERO, AEGIS_V3],
}
