import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Currency, CurrencyAmount } from '@uniswap/sdk-core'
import { constants } from 'ethers'
import { Erc20 } from '../../lib/types/ext/Erc20'
import { Erc20__factory } from '../../lib/types/ext/factories/Erc20__factory'

export const getBalance = async (alice: SignerWithAddress, currency: Currency): Promise<CurrencyAmount<Currency>> => {
  if (!currency.isToken) {
    return CurrencyAmount.fromRawAmount(currency, (await alice.getBalance()).toString())
  }

  const aliceTokenIn: Erc20 = Erc20__factory.connect(currency.address, alice)

  return CurrencyAmount.fromRawAmount(currency, (await aliceTokenIn.balanceOf(alice.address)).toString())
}

export const getBalanceAndApprove = async (
  alice: SignerWithAddress,
  approveTarget: string,
  currency: Currency
): Promise<CurrencyAmount<Currency>> => {
  if (currency.isToken) {
    const aliceTokenIn: Erc20 = Erc20__factory.connect(currency.address, alice)

    await (await aliceTokenIn.approve(approveTarget, constants.MaxUint256)).wait()
  }

  return getBalance(alice, currency)
}
