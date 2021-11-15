require('@nomiclabs/hardhat-ethers')
require('dotenv').config()

module.exports = {
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      blockGasLimit: 150_000_000,
      forking: {
        enabled: true,
        url: `${process.env.ARCHIVE_NODE_RPC}`,
        blockNumber: 12972642,
      },
    },
  },
}
