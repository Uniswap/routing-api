require('@nomiclabs/hardhat-ethers')
require('dotenv').config()

module.exports = {
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      accounts: {
        count: 50,
        balance: '1000000000000000000000',
      },
      chainId: 1,
      forking: {
        enabled: true,
        url: `${process.env.ARCHIVE_NODE_RPC}`,
      },
    },
  },
}
