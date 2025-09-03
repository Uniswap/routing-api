# Lambda to Node.js Server Migration

This document outlines the migration from AWS Lambda architecture to a Node.js HTTP server while preserving all existing handler code and business logic unchanged.

## Migration Strategy

The migration uses a minimal Lambda→HTTP adapter that maps Express requests to AWS Lambda event/context objects. This preserves the existing `APIGLambdaHandler` framework completely unchanged while enabling HTTP server deployment.

## Implementation

### 1. Lambda-to-HTTP Adapter

Create `src/adapters/lambdaToHttp.ts`:

```typescript
import type { APIGatewayProxyEvent, Context, APIGatewayProxyResult } from 'aws-lambda';
import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';

export function lambdaToExpress(handler: (
  event: APIGatewayProxyEvent,
  context: Context
) => Promise<APIGatewayProxyResult>) {
  return async (req: Request, res: Response) => {
    try {
      const event: APIGatewayProxyEvent = {
        body: req.body ? JSON.stringify(req.body) : null,
        queryStringParameters: req.query as any,
        headers: req.headers as any,
        httpMethod: req.method,
        path: req.path,
        resource: req.path,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        isBase64Encoded: false,
      };

      const context: Context = {
        awsRequestId: req.headers['x-request-id']?.toString() || randomUUID(),
        callbackWaitsForEmptyEventLoop: false,
        functionName: 'routing-api-local',
        functionVersion: '1',
        invokedFunctionArn: 'arn:aws:lambda:local:0:function:routing-api',
        memoryLimitInMB: '512',
        logGroupName: '/aws/lambda/routing-api-local',
        logStreamName: 'local',
        getRemainingTimeInMillis: () => 30000,
        done: () => undefined,
        fail: () => undefined,
        succeed: () => undefined,
      };

      const result = await handler(event, context);

      if (result.headers) {
        for (const [k, v] of Object.entries(result.headers)) {
          if (v !== undefined) res.setHeader(k, v as string);
        }
      }

      res.status(result.statusCode || 200);
      res.send(result.body || '');
    } catch (err: any) {
      res.status(502).json({ message: 'Internal server error', error: err?.message });
    }
  };
}
```

### 2. Express Server

Create `src/server.ts`:

```typescript
import express from 'express';
import { lambdaToExpress } from './adapters/lambdaToHttp';

const { quoteHandler } = require('../lib/handlers');

async function bootstrap() {
  const app = express();

  app.set('trust proxy', true);
  app.use(express.json({ limit: '1mb' }));

  app.get('/quote', lambdaToExpress(quoteHandler));

  app.get('/healthz', (_req, res) => res.status(200).send('ok'));
  app.get('/readyz', (_req, res) => res.status(200).send('ready'));

  const port = Number(process.env.PORT ?? 8080);
  const server = app.listen(port, () => {
    console.log(`routing-api listening on :${port}`);
  });

  process.on('SIGTERM', () => server.close(() => process.exit(0)));
  process.on('SIGINT', () => server.close(() => process.exit(0)));
}

bootstrap();
```

### 3. Configuration Changes

**Update package.json scripts and dependencies:**

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "start": "node dist/src/server.js",
    "build": "tsc && cp -r lib dist/",
    "server": "npm run build && npm start"
  },
  "dependencies": {
    "express": "^4.18.2"
  },
  "devDependencies": {
    "@types/express": "^4.17.17",
    "tsx": "^3.12.7"
  }
}
```

**Update tsconfig.json:**

```json
{
  "compilerOptions": {
    "module": "commonjs"
  }
}
```

Change from `"module": "esnext"` to `"module": "commonjs"` to match the existing handlers' CommonJS export pattern.

## Preserved Components

The following remain completely unchanged:
- All handler files (`lib/handlers/*`)
- Business logic and routing algorithms
- `APIGLambdaHandler` framework
- Injector pattern
- Environment variable configuration

## Usage

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm run server
```

**Docker:**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY dist ./dist
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node","dist/src/server.js"]
```

## Benefits

- Minimal code changes (2 new files, ~80 lines total)
- Zero refactoring of existing handlers
- Preserves ability to switch back to Lambda
- Same environment variable configuration
- All existing logging and metrics preserved