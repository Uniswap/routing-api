import 'dotenv/config';
import express from 'express';
import { handleSwap } from './adapters/handleSwap';
import { handleSwaps } from './adapters/handleSwaps';
import { handleQuote } from './adapters/handleQuote';
import { handleLpApprove } from './adapters/handleLpApprove';
import { handleLpCreate } from './adapters/handleLpCreate';
import { quoteLimiter, generalLimiter } from './middleware/rateLimiter';


async function bootstrap() {
  const app = express();

  // Minimal middleware for MVP
  app.set('trust proxy', true);
  app.use(express.json({ limit: '1mb' }));

  const knownOrigins = [
    'https://bapp.juiceswap.com/',
    'https://dev.bapp.juiceswap.com/',
    'http://localhost:3000',
  ];

  const envOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim()) : [];
  const allowedOrigins = [...new Set([...knownOrigins, ...envOrigins])];

  app.use((req, res, next) => {
    const requestOrigin = req.headers.origin;

    // Check if origin is from juiceswap.com domain
    const isJuiceSwapDomain = requestOrigin && /^https?:\/\/([\w-]+\.)?juiceswap\.com(:\d+)?$/.test(requestOrigin);

    if (isJuiceSwapDomain) {
      res.header('Access-Control-Allow-Origin', requestOrigin);
    } else if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
      res.header('Access-Control-Allow-Origin', requestOrigin);
    } else if (!requestOrigin) {
      res.header('Access-Control-Allow-Origin', allowedOrigins[0]);
    }
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-request-source, x-app-version, x-api-key, x-universal-router-version, x-viem-provider-enabled, x-uniquote-enabled' );
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  });

  // Route mapping - handlers remain completely unchanged
  // Quote endpoint gets strict rate limiting (10-60 req/min based on wallet)
  app.post('/v1/quote', quoteLimiter, handleQuote);

  // Other endpoints get more lenient rate limiting (100 req/min)
  app.post('/v1/swap', generalLimiter, handleSwap);

  app.get('/v1/swaps', handleSwaps);

  app.post('/v1/lp/approve', generalLimiter, handleLpApprove);

  app.post('/v1/lp/create', generalLimiter, handleLpCreate);

  // Health endpoints
  app.get('/healthz', (_req, res) => res.status(200).send('ok'));
  app.get('/readyz', (_req, res) => res.status(200).send('ready'));

  // Version endpoint
  app.get('/version', (_req, res) => {
    const path = require('path');
    const fs = require('fs');

    try {
      // In dev: __dirname = /path/to/src -> need ../package.json
      // In prod: __dirname = /path/to/dist/src -> need ../../package.json
      // Try both paths
      let packageJsonPath = path.join(__dirname, '..', 'package.json');

      if (!fs.existsSync(packageJsonPath)) {
        packageJsonPath = path.join(__dirname, '..', '..', 'package.json');
      }

      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      // Try to get git commit hash
      let gitCommit = 'unknown';
      try {
        const { execSync } = require('child_process');
        gitCommit = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
      } catch (e) {
        // Git not available or not a git repo
      }

      res.json({
        version: packageJson.version,
        name: packageJson.name,
        commit: gitCommit
      });
    } catch (error) {
      res.status(500).json({ error: 'Could not read version info' });
    }
  });

  const port = Number(process.env.PORT ?? 3000);
  const server = app.listen(port, () => {
    console.log(`routing-api listening on :${port}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => server.close(() => process.exit(0)));
  process.on('SIGINT', () => server.close(() => process.exit(0)));
}

bootstrap();