#!/bin/sh

# Docker entrypoint script for Uniswap Routing API

echo "🦄 Starting Uniswap Routing API (Sepolia Only)"
echo "================================================"

# Check if required environment variables are set
if [ -z "$WEB3_RPC_11155111" ]; then
    echo "⚠️  Warning: WEB3_RPC_11155111 is not set. Using default Sepolia RPC."
    export WEB3_RPC_11155111="https://rpc.sepolia.org"
fi

# Set default port if not provided
if [ -z "$PORT" ]; then
    export PORT=8080
fi

echo "✅ Configuration:"
echo "   - Port: $PORT"
echo "   - Sepolia RPC: $WEB3_RPC_11155111"
echo "   - Node Environment: ${NODE_ENV:-development}"

# Create logs directory if it doesn't exist
mkdir -p /app/logs

echo "🚀 Starting server..."

# Start the application
exec node --experimental-specifier-resolution=node local-server-cjs.js