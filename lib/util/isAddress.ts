export const isAddress = (s: string) => {
  // Ethereum addresses are 42-character long hex strings that start with
  // 0x. This function can be improved in the future by validating that the string
  // only contains 0-9 and A-F.
  return s.length === 42 && s.startsWith('0x')
}
