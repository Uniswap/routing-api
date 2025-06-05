import { DELEGATION_MAGIC_PREFIX } from '@uniswap/smart-wallet-sdk'

// copy paste from https://github.com/Uniswap/external-api/blob/73dd547047b70dc6a394cb6972a9192c864d9b98/lib/util/delegation.ts#L12
export const getCurrentDelegationAddress = (code: string | null): string | null => {
  if (!code) {
    return null
  }
  // Check if the code matches our 7702 contract prefix
  if (code.startsWith(DELEGATION_MAGIC_PREFIX)) {
    // Remove the magic prefix and return the rest of the code
    return ('0x' + code.slice(DELEGATION_MAGIC_PREFIX.length)).toLowerCase()
  }
  return null
}
