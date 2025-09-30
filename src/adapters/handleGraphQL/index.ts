import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { typeDefs } from './schema';
import { resolvers } from './resolvers';
import { Request } from 'express';

let apolloServer: ApolloServer | null = null;

export const initApolloServer = async () => {
  if (apolloServer) {
    return apolloServer;
  }

  apolloServer = new ApolloServer({
    typeDefs,
    resolvers,
    introspection: true,
    includeStacktraceInErrorResponses: process.env.NODE_ENV !== 'production',
  });

  await apolloServer.start();
  console.log('✅ Apollo Server started successfully');
  return apolloServer;
};

export const getApolloMiddleware = async () => {
  try {
    const server = await initApolloServer();
    return expressMiddleware(server, {
      context: async ({ req }: { req: Request }) => ({
        headers: req.headers,
        ip: req.ip,
      }),
    });
  } catch (error) {
    console.error('❌ Failed to initialize Apollo Server:', error);
    throw error;
  }
};