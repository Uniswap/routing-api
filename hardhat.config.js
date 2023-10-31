require('@nomiclabs/hardhat-ethers')
require('dotenv').config()

module.exports = {
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      chainId: 1,
      forking: {
        enabled: true,
        url: `${process.env.ARCHIVE_NODE_RPC}`,
      },
    },
  },
}
