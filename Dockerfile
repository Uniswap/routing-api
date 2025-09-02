# Multi-stage build for Uniswap Routing API
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# Install dependencies
RUN npm ci --only=production=false

# Copy source code
COPY lib/ ./lib/
COPY bin/ ./bin/

# Build the application
RUN npm run build

# Fix ES module imports for runtime
COPY fix-imports.py fix-sor-imports.py fix-all-imports.py ./
RUN python3 fix-all-imports.py

# Production stage
FROM node:20-alpine AS runtime

# Set working directory
WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache python3

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy configuration files
COPY local-server-cjs.js ./
COPY .env ./
COPY docker-entrypoint.sh ./

# Make entrypoint script executable
RUN chmod +x docker-entrypoint.sh

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S routing -u 1001 -G nodejs

# Create logs directory
RUN mkdir -p /app/logs

# Change ownership of app directory
RUN chown -R routing:nodejs /app
USER routing

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Start the application
ENTRYPOINT ["./docker-entrypoint.sh"]