#!/bin/bash

# Uniswap Routing API (Sepolia) Docker Startup Script

set -e

echo "🦄 Starting Uniswap Routing API in Docker"
echo "=========================================="

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop first."
    echo ""
    echo "To install Docker:"
    echo "  brew install --cask docker"
    echo ""
    echo "Then start Docker Desktop from Applications folder."
    exit 1
fi

echo "✅ Docker is running"

# Check if container is already running
if docker ps | grep -q "uniswap-routing-api-sepolia"; then
    echo "⚠️  Container is already running"
    echo "To restart: docker-compose restart"
    echo "To stop: docker-compose down"
    exit 0
fi

# Build and start the container
echo "🔨 Building and starting container..."

# Use docker-compose to start
if command -v docker-compose &> /dev/null; then
    docker-compose up -d --build
elif docker compose version &> /dev/null 2>&1; then
    docker compose up -d --build
else
    echo "❌ Docker Compose not found. Installing..."
    brew install docker-compose
    docker-compose up -d --build
fi

echo "⏳ Waiting for container to be ready..."
sleep 15

# Test the API
echo "🧪 Testing API endpoints..."

# Health check
if curl -f -s http://localhost:8080/health >/dev/null; then
    echo "✅ Health check: PASSED"
else
    echo "❌ Health check: FAILED"
    echo "Container logs:"
    docker-compose logs routing-api
    exit 1
fi

echo ""
echo "🎉 Uniswap Routing API is running successfully!"
echo ""
echo "📍 Endpoints:"
echo "   Health: http://localhost:8080/health"
echo "   Quote:  http://localhost:8080/quote"
echo ""
echo "📊 Management Commands:"
echo "   Logs:    docker-compose logs -f routing-api"
echo "   Stop:    docker-compose down"
echo "   Restart: docker-compose restart routing-api"
echo ""
echo "🔗 Example Sepolia Quote Request:"
echo "curl \"http://localhost:8080/quote?tokenInAddress=0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14&tokenInChainId=11155111&tokenOutAddress=0x1f9840a85d5af5bf1d1762f925bdaddc4201f984&tokenOutChainId=11155111&amount=1000000000000000000&type=exactIn\""