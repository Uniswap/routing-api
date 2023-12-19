import { describe, it, expect } from '@jest/globals'
import { isAddress } from '../../../../../lib/util/isAddress'

describe('isAddress', () => {
  it('returns true for a valid address', () => {
    const uniTokenAddress = '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984'
    expect(isAddress(uniTokenAddress)).toBe(true)
  })

  it('returns true for the zero address', () => {
    const zeroAddress = '0x0000000000000000000000000000000000000000'
    expect(isAddress(zeroAddress)).toBe(true)
  })

  it('returns false if there are less than 42 characters', () => {
    const invalidAddress = '0xabc'
    expect(isAddress(invalidAddress)).toBe(false)
  })

  it('returns false if the address is not prefixed with 0x', () => {
    const uniTokenAddressNo0x = '__1f9840a85d5aF5bf1D1762F925BDADdC4201F984'
    expect(isAddress(uniTokenAddressNo0x)).toBe(false)
  })
})
