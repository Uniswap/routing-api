# Rate Limiting

This API implements IP-based rate limiting to protect against bot traffic and API abuse.

## Rate Limits

### Quote Endpoint (`/v1/quote`)

**Dynamic rate limiting based on wallet connection:**

- **With Connected Wallet**: 60 requests/minute
- **Without Wallet / Placeholder Address**: 10 requests/minute

The system detects if a valid Ethereum wallet address is provided in the `swapper` field. Bots typically don't provide a wallet or use the placeholder address `0xAAAA44272dc658575Ba38f43C438447dDED45358`.

### Other Endpoints

- `/v1/swap`: 100 requests/minute
- `/v1/lp/approve`: 100 requests/minute
- `/v1/lp/create`: 100 requests/minute
- `/v1/swaps`: No rate limit (read-only)

## How It Works

1. **IP Detection**: Extracts client IP from:
   - `x-forwarded-for` header (for proxies)
   - `x-real-ip` header
   - Direct connection IP

2. **Wallet Detection**: Checks if request includes a valid connected wallet address

3. **Rate Limiting**: Tracks requests per IP per minute

4. **Response Headers**: Returns standard rate limit headers:
   - `RateLimit-Limit`: Max requests allowed
   - `RateLimit-Remaining`: Remaining requests in window
   - `RateLimit-Reset`: Timestamp when limit resets

## Rate Limit Response

When rate limit is exceeded, API returns:

```json
{
  "error": "Too many requests",
  "message": "You have exceeded the rate limit. Please try again later.",
  "retryAfter": 60,
  "hint": "Rate limit: 10 requests/minute (connect wallet for higher limit)"
}
```

HTTP Status: `429 Too Many Requests`

## Configuration

Rate limits can be adjusted in `src/middleware/rateLimiter.ts`:

```typescript
// For quote endpoint
max: (req) => hasConnectedWallet(req) ? 60 : 10

// For other endpoints
max: 100
```

Window size is currently set to 1 minute (60,000ms).

## Monitoring

Rate limit violations are logged to console:

```
[Rate Limit] Blocked request from IP: 1.2.3.4, hasWallet: false
```

Monitor these logs to identify:
- Heavy bot traffic
- IPs that should be completely blocked
- Whether limits need adjustment

## Testing

Test rate limiting locally:

```bash
# Test without wallet (10 req/min limit)
for i in {1..15}; do
  curl -X POST http://localhost:3000/v1/quote \
    -H "Content-Type: application/json" \
    -d '{
      "tokenInChainId": 5003,
      "tokenIn": "0x0000000000000000000000000000000000000000",
      "tokenOutChainId": 5003,
      "tokenOut": "0x4200000000000000000000000000000000000006",
      "amount": "1000000000000000000",
      "type": "EXACT_INPUT"
    }'
  echo ""
done

# Test with wallet (60 req/min limit)
for i in {1..65}; do
  curl -X POST http://localhost:3000/v1/quote \
    -H "Content-Type: application/json" \
    -d '{
      "tokenInChainId": 5003,
      "tokenIn": "0x0000000000000000000000000000000000000000",
      "tokenOutChainId": 5003,
      "tokenOut": "0x4200000000000000000000000000000000000006",
      "amount": "1000000000000000000",
      "type": "EXACT_INPUT",
      "swapper": "0x1234567890123456789012345678901234567890"
    }'
  echo ""
done
```

## Future Improvements

1. **Redis-based rate limiting** for multi-instance deployments
2. **IP whitelist** for trusted services
3. **Permanent bans** for persistent abusers
4. **Tiered limits** based on API keys
5. **Geographic rate limits** (stricter for high-bot regions)