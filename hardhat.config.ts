import '@nomiclabs/hardhat-ethers'
import { HardhatUserConfig } from 'hardhat/types'
require('dotenv').config()

const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      blockGasLimit: 150_000_000,
      forking: {
        enabled: true,
        url: `${process.env.ARCHIVE_NODE_RPC!}`,
        blockNumber: 12972642,
      },
    },
  },
}

export default config
