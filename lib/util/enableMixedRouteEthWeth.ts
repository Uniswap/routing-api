export function enableMixedRouteEthWeth(requestSourceHeader?: string): boolean {
  switch (requestSourceHeader) {
    // only used for e2e-test purpose
    case 'e2e-test':
    case 'uniswap-web':
      return true
    // TODO: enable once web, mobile, extension releases the FE bug fix for mixed route (https://uniswapteam.slack.com/archives/C07AD3507SQ/p1739296535359709?thread_ts=1739224900.129809&cid=C07AD3507SQ)
    // TODO: for mobile, we need to ensure backward compatibility with the old version, using app version (https://uniswapteam.slack.com/archives/C07AD3507SQ/p1739309767819639?thread_ts=1739224900.129809&cid=C07AD3507SQ)
    default:
      return false
  }
}
