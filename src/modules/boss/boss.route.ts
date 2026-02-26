import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { bossService } from './boss.service';

const errorSchema = z.object({
  message: z.string(),
  statusCode: z.number().optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const loginResponseSchema = z.object({
  ok: z.boolean(),
  boss: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    fullName: z.string(),
  }),
});

const meResponseSchema = z.object({
  ok: z.boolean(),
  boss: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    fullName: z.string(),
  }),
});

export async function bossRoutes(app: FastifyInstance) {
  // Login
  app.withTypeProvider<ZodTypeProvider>().post('/auth/login', {
    schema: {
      body: loginSchema,
      response: {
        200: loginResponseSchema,
        401: errorSchema,
      },
      tags: ['Boss Auth'],
      description: 'Login boss and set session cookie'
    },
  }, async (request, reply) => {
    try {
      const boss = await bossService.login(request.body);

      if (!boss) {
        return reply.code(401).send({
          message: 'Invalid email or password',
          statusCode: 401
        });
      }

      const token = app.jwt.sign({
        bossId: boss.id,
        sub: 'boss'
      });

      reply.setCookie('kora_boss_session', token, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60, // 7 days
      });

      return {
        ok: true,
        boss
      };
    } catch (error: any) {
      return reply.code(401).send({
        message: error.message || 'Login failed',
        statusCode: 401
      });
    }
  });

  // Me
  app.withTypeProvider<ZodTypeProvider>().get('/auth/me', {
    onRequest: [async (request, reply) => {
      try {
        console.log('Incoming cookies for /auth/me:', request.cookies);
        const token = request.cookies['kora_boss_session'];
        if (!token) {
          reply.code(401).send({ message: 'No boss session token', statusCode: 401 });
          return;
        }
        
        const decoded: any = app.jwt.verify(token);
        request.user = decoded;

        if (request.user.sub !== 'boss' && !request.user.bossId) {
            reply.code(401).send({ message: 'Not a boss token', statusCode: 401 });
            return;
        }
      } catch (err: any) {
        reply.code(401).send({ message: err.message || 'Unauthorized', statusCode: 401 });
      }
    }],
    schema: {
      response: {
        200: meResponseSchema,
        401: errorSchema
      }
    }
  }, async (request, reply) => {
      const payload: any = request.user; 
      const boss = await bossService.getBoss(payload.bossId);
      if (!boss) return reply.code(401).send({ message: 'Unauthorized', statusCode: 401 });
      return { ok: true, boss };
  });

  // Logout
  app.withTypeProvider<ZodTypeProvider>().post('/auth/logout', {
      schema: {
          response: {
              200: z.object({ ok: z.boolean(), message: z.string() })
          }
      }
  }, async (request, reply) => {
      reply.clearCookie('kora_boss_session', { path: '/' });
      return { ok: true, message: 'Logged out' };
  });
}
