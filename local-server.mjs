#!/usr/bin/env node

/**
 * Local development server for the Uniswap Routing API
 * This wraps the Lambda handler in an Express server for local testing
 */

import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import the handler with proper ES module resolution
const { handler: quoteHandler } = await import('./dist/lib/handlers/quote/quote.js');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Quote endpoint
app.get('/quote', async (req, res) => {
  try {
    // Create Lambda-like event object
    const event = {
      queryStringParameters: req.query,
      headers: req.headers,
      pathParameters: {},
      body: null,
      isBase64Encoded: false
    };

    // Create Lambda-like context object
    const context = {
      functionName: 'quote-handler',
      functionVersion: '1',
      invokedFunctionArn: 'arn:aws:lambda:local:123456789012:function:quote-handler',
      memoryLimitInMB: '512',
      awsRequestId: `local-${Date.now()}`,
      logGroupName: '/aws/lambda/quote-handler',
      logStreamName: 'local-stream',
      getRemainingTimeInMillis: () => 30000,
      done: () => {},
      fail: () => {},
      succeed: () => {}
    };

    // Call the Lambda handler
    const response = await quoteHandler(event, context);

    // Set response headers
    if (response.headers) {
      Object.keys(response.headers).forEach(key => {
        res.setHeader(key, response.headers[key]);
      });
    }

    // Send response
    res.status(response.statusCode || 200);
    
    if (response.body) {
      const body = response.isBase64Encoded 
        ? Buffer.from(response.body, 'base64').toString() 
        : response.body;
      
      try {
        res.json(JSON.parse(body));
      } catch {
        res.send(body);
      }
    } else {
      res.end();
    }
  } catch (error) {
    console.error('Error handling request:', error);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: error.message 
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║     🦄 Uniswap Routing API Local Server              ║
║                                                       ║
║     Server running at: http://localhost:${PORT}         ║
║                                                       ║
║     Endpoints:                                        ║
║     - GET /health                                     ║
║     - GET /quote                                      ║
║                                                       ║
║     Example:                                          ║
║     curl http://localhost:${PORT}/quote?\\              ║
║       tokenInAddress=0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2&\\
║       tokenInChainId=1&\\
║       tokenOutAddress=0x1f9840a85d5af5bf1d1762f925bdaddc4201f984&\\
║       tokenOutChainId=1&\\
║       amount=100&\\
║       type=exactIn                                    ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});