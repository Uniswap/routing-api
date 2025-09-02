#!/bin/bash

# Build script for Uniswap Routing API Docker container

set -e

echo "🦄 Building Uniswap Routing API Docker Container"
echo "================================================"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "   macOS: brew install --cask docker"
    echo "   Linux: https://docs.docker.com/engine/install/"
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not available."
    echo "   Install: https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✅ Docker is available"

# Build the image
echo "🔨 Building Docker image..."
docker build -t uniswap-routing-api-sepolia . --no-cache

echo "✅ Docker image built successfully"

# Test the build
echo "🧪 Testing the container..."
docker run --rm --name test-routing-api \
  -e WEB3_RPC_11155111=https://rpc.sepolia.org \
  -p 8081:8080 \
  -d \
  uniswap-routing-api-sepolia

# Wait a bit for startup
sleep 10

# Test health endpoint
if curl -f http://localhost:8081/health > /dev/null 2>&1; then
    echo "✅ Container health check passed"
else
    echo "❌ Container health check failed"
    docker logs test-routing-api
fi

# Clean up test container
docker stop test-routing-api

echo "🎉 Docker build and test completed successfully!"
echo ""
echo "To run the container:"
echo "  docker-compose up -d"
echo ""
echo "Or manually:"
echo "  docker run -d --name routing-api -p 8080:8080 \\"
echo "    -e WEB3_RPC_11155111=https://rpc.sepolia.org \\"
echo "    uniswap-routing-api-sepolia"