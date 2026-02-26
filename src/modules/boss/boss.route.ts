import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { bossService } from './boss.service';
import { bossBossesService } from './boss.bosses.service';
import { bossCompaniesService } from './boss.companies.service';

const errorSchema = z.object({ message: z.string(), statusCode: z.number().optional() });
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
const loginResponseSchema = z.object({ ok: z.boolean(), boss: z.object({ id: z.string().uuid(), email: z.string().email(), fullName: z.string() }) });

const createBossSchema = z.object({ email: z.string().email().max(255), password: z.string().min(8).max(128), fullName: z.string().max(255).optional() });
const updateBossSchema = z.object({ email: z.string().email().max(255).optional(), fullName: z.string().max(255).optional(), newPassword: z.string().min(8).max(128).optional() });
const updateCompanySchema = z.object({ staffLimit: z.number().int().min(0).max(500) });

const subscriptionActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add_months"), months: z.number().int().min(1).max(120), note: z.string().max(1000).optional(), amountNotes: z.string().max(500).optional(), kind: z.enum(["payment", "complimentary"]).optional() }),
  z.object({ action: z.literal("add_days"), days: z.number().int().min(1).max(365), note: z.string().max(1000).optional(), kind: z.enum(["grace", "complimentary"]).optional() }),
  z.object({ action: z.literal("suspend") }),
  z.object({ action: z.literal("resume") }),
]);

export async function bossRoutes(app: FastifyInstance) {
  const requireBossAuth = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const token = request.cookies['kora_boss_session'];
      if (!token) { reply.code(401).send({ message: 'No boss session token', statusCode: 401 }); return; }
      const decoded: any = app.jwt.verify(token);
      request.user = decoded;
      if (request.user.sub !== 'boss' && !request.user.bossId) { reply.code(401).send({ message: 'Not a boss token', statusCode: 401 }); return; }
    } catch (err: any) {
      reply.code(401).send({ message: err.message || 'Unauthorized', statusCode: 401 });
    }
  };

  app.withTypeProvider<ZodTypeProvider>().post('/auth/login', {
    schema: { body: loginSchema, response: { 200: loginResponseSchema, 401: errorSchema }, tags: ['Boss Auth'] },
  }, async (request, reply) => {
    try {
      const boss = await bossService.login(request.body);
      if (!boss) return reply.code(401).send({ message: 'Invalid email or password', statusCode: 401 });
      const token = app.jwt.sign({ bossId: boss.id, sub: 'boss' });
      reply.setCookie('kora_boss_session', token, { path: '/', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 });
      return { ok: true, boss };
    } catch (error: any) {
      return reply.code(401).send({ message: error.message || 'Login failed', statusCode: 401 });
    }
  });

  app.withTypeProvider<ZodTypeProvider>().get('/auth/me', {
    onRequest: [requireBossAuth], schema: { response: { 200: loginResponseSchema, 401: errorSchema } }
  }, async (request, reply) => {
      const payload: any = request.user; 
      const boss = await bossService.getBoss(payload.bossId);
      if (!boss) return reply.code(401).send({ message: 'Unauthorized', statusCode: 401 });
      return { ok: true, boss };
  });

  app.withTypeProvider<ZodTypeProvider>().post('/auth/logout', {
      schema: { response: { 200: z.object({ ok: z.boolean(), message: z.string() }) } }
  }, async (request, reply) => {
      reply.clearCookie('kora_boss_session', { path: '/' });
      return { ok: true, message: 'Logged out' };
  });

  app.withTypeProvider<ZodTypeProvider>().get('/bosses', {
    onRequest: [requireBossAuth],
  }, async (request, reply) => {
    return { ok: true, bosses: await bossBossesService.getBosses() };
  });

  app.withTypeProvider<ZodTypeProvider>().post('/bosses', {
    onRequest: [requireBossAuth], schema: { body: createBossSchema }
  }, async (request, reply) => {
    try { return await bossBossesService.createBoss(request.body);
    } catch(err: any) { return reply.code(400).send({ message: err.message, error: err.message }); }
  });

  app.withTypeProvider<ZodTypeProvider>().patch('/bosses/:id', {
    onRequest: [requireBossAuth], schema: { body: updateBossSchema, params: z.object({ id: z.string().uuid() }) }
  }, async (request, reply) => {
    try { return await bossBossesService.updateBoss(request.params.id, (request.user as any).bossId, request.body);
    } catch(err: any) { return reply.code(400).send({ message: err.message, error: err.message }); }
  });

  app.withTypeProvider<ZodTypeProvider>().delete('/bosses/:id', {
    onRequest: [requireBossAuth], schema: { params: z.object({ id: z.string().uuid() }) }
  }, async (request, reply) => {
    try { return await bossBossesService.deleteBoss(request.params.id, (request.user as any).bossId);
    } catch(err: any) { return reply.code(400).send({ message: err.message, error: err.message }); }
  });

  app.withTypeProvider<ZodTypeProvider>().get('/companies', {
    onRequest: [requireBossAuth],
    schema: { querystring: z.object({ q: z.string().optional(), page: z.coerce.number().optional().default(1), limit: z.coerce.number().optional().default(10) }) }
  }, async (request, reply) => {
    try { return await bossCompaniesService.getCompanies(request.query.q || "", request.query.page, request.query.limit);
    } catch(err: any) { return reply.code(400).send({ message: err.message, error: err.message }); }
  });

  app.withTypeProvider<ZodTypeProvider>().patch('/companies/:id', {
    onRequest: [requireBossAuth], schema: { params: z.object({ id: z.string().uuid() }), body: updateCompanySchema }
  }, async (request, reply) => {
    try { return await bossCompaniesService.updateCompany(request.params.id, request.body.staffLimit);
    } catch(err: any) { return reply.code(400).send({ message: err.message, error: err.message }); }
  });

  app.withTypeProvider<ZodTypeProvider>().post('/companies/:id/subscription', {
    onRequest: [requireBossAuth], schema: { params: z.object({ id: z.string().uuid() }), body: subscriptionActionSchema }
  }, async (request, reply) => {
    try { return await bossCompaniesService.subscriptionAction(request.params.id, (request.user as any).bossId, request.body);
    } catch(err: any) { return reply.code(400).send({ message: err.message, error: err.message }); }
  });
}
