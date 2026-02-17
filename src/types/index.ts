import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { JWT } from '@fastify/jwt';

declare module 'fastify' {
  interface FastifyRequest {
    jwt: JWT;
  }
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      userId: string;
      companyId: string;
      companyUserId: string;
      role: string;
    };
    user: {
      userId: string;
      companyId: string;
      companyUserId: string;
      role: string;
    };
  }
}
