import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { regionRepository } from './regions.repository';
import { regionSchema, createRegionSchema, updateRegionSchema } from './regions.schema';

const managerRoles = ['boss', 'manager'] as const;

export async function regionsRoutes(app: FastifyInstance) {
  // ── Auth guard ─────────────────────────────────────────────────────────────
  app.addHook('onRequest', async (request, reply) => {
    try { await request.jwtVerify(); }
    catch (err) { reply.send(err); }
  });

  // ── GET /  — list all regions ──────────────────────────────────────────────
  app.withTypeProvider<ZodTypeProvider>().get('/', {
    schema: {
      response: {
        200: z.object({ ok: z.boolean(), regions: z.array(regionSchema) }),
        401: z.object({ message: z.string() }),
      },
    },
  }, async (request, reply) => {
    const { authService } = await import('../auth/auth.service');
    const context = await authService.getContext(request.user.userId);
    if (!context) return reply.code(401).send({ message: 'Unauthorized' });

    const regions = await regionRepository.findAll(context.company.id);
    return { ok: true, regions };
  });

  // ── GET /:id — single region ───────────────────────────────────────────────
  app.withTypeProvider<ZodTypeProvider>().get('/:id', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      response: {
        200: z.object({ ok: z.boolean(), region: regionSchema }),
        401: z.object({ message: z.string() }),
        404: z.object({ message: z.string() }),
      },
    },
  }, async (request, reply) => {
    const { authService } = await import('../auth/auth.service');
    const context = await authService.getContext(request.user.userId);
    if (!context) return reply.code(401).send({ message: 'Unauthorized' });

    const region = await regionRepository.findById(request.params.id, context.company.id);
    if (!region) return reply.code(404).send({ message: 'Region not found' });
    return { ok: true, region };
  });

  // ── POST /  — create region (manager+ only) ────────────────────────────────
  app.withTypeProvider<ZodTypeProvider>().post('/', {
    schema: {
      body: createRegionSchema,
      response: {
        201: z.object({ ok: z.boolean(), region: regionSchema }),
        401: z.object({ message: z.string() }),
        403: z.object({ message: z.string() }),
        409: z.object({ message: z.string() }),
      },
    },
  }, async (request, reply) => {
    const { authService } = await import('../auth/auth.service');
    const context = await authService.getContext(request.user.userId);
    if (!context) return reply.code(401).send({ message: 'Unauthorized' });
    if (!managerRoles.includes(context.user.role as typeof managerRoles[number])) {
      return reply.code(403).send({ message: 'Managers and above only' });
    }

    try {
      const region = await regionRepository.create({
        companyId: context.company.id,
        ...request.body,
      });
      return reply.code(201).send({ ok: true, region });
    } catch (err: any) {
      if (err?.code === '23505') {
        return reply.code(409).send({ message: `Region "${request.body.name}" already exists` });
      }
      throw err;
    }
  });

  // ── PATCH /:id — update region ─────────────────────────────────────────────
  app.withTypeProvider<ZodTypeProvider>().patch('/:id', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      body: updateRegionSchema,
      response: {
        200: z.object({ ok: z.boolean(), region: regionSchema }),
        401: z.object({ message: z.string() }),
        403: z.object({ message: z.string() }),
        404: z.object({ message: z.string() }),
        409: z.object({ message: z.string() }),
      },
    },
  }, async (request, reply) => {
    const { authService } = await import('../auth/auth.service');
    const context = await authService.getContext(request.user.userId);
    if (!context) return reply.code(401).send({ message: 'Unauthorized' });
    if (!managerRoles.includes(context.user.role as typeof managerRoles[number])) {
      return reply.code(403).send({ message: 'Managers and above only' });
    }

    try {
      const region = await regionRepository.update(request.params.id, context.company.id, request.body);
      if (!region) return reply.code(404).send({ message: 'Region not found' });
      return { ok: true, region };
    } catch (err: any) {
      if (err?.code === '23505') {
        return reply.code(409).send({ message: `Region name already in use` });
      }
      throw err;
    }
  });

  // ── DELETE /:id — delete region ────────────────────────────────────────────
  app.withTypeProvider<ZodTypeProvider>().delete('/:id', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      response: {
        200: z.object({ ok: z.boolean(), message: z.string() }),
        401: z.object({ message: z.string() }),
        403: z.object({ message: z.string() }),
        404: z.object({ message: z.string() }),
      },
    },
  }, async (request, reply) => {
    const { authService } = await import('../auth/auth.service');
    const context = await authService.getContext(request.user.userId);
    if (!context) return reply.code(401).send({ message: 'Unauthorized' });
    if (!managerRoles.includes(context.user.role as typeof managerRoles[number])) {
      return reply.code(403).send({ message: 'Managers and above only' });
    }

    const deleted = await regionRepository.delete(request.params.id, context.company.id);
    if (!deleted) return reply.code(404).send({ message: 'Region not found' });
    return { ok: true, message: 'Region deleted. Shops have been unassigned.' };
  });

  // ── PATCH /shops/:shopId/region — assign a shop to a region ───────────────
  app.withTypeProvider<ZodTypeProvider>().patch('/shops/:shopId/region', {
    schema: {
      params: z.object({ shopId: z.string().uuid() }),
      body: z.object({ regionId: z.string().uuid().nullable() }),
      response: {
        200: z.object({ ok: z.boolean() }),
        401: z.object({ message: z.string() }),
        403: z.object({ message: z.string() }),
      },
    },
  }, async (request, reply) => {
    const { authService } = await import('../auth/auth.service');
    const context = await authService.getContext(request.user.userId);
    if (!context) return reply.code(401).send({ message: 'Unauthorized' });
    if (!managerRoles.includes(context.user.role as typeof managerRoles[number])) {
      return reply.code(403).send({ message: 'Managers and above only' });
    }

    await regionRepository.assignShopRegion(
      request.params.shopId,
      request.body.regionId,
      context.company.id
    );
    return { ok: true };
  });

  // ── PATCH /staff/:companyUserId/region — assign a rep's default region ─────
  app.withTypeProvider<ZodTypeProvider>().patch('/staff/:companyUserId/region', {
    schema: {
      params: z.object({ companyUserId: z.string().uuid() }),
      body: z.object({ regionId: z.string().uuid().nullable() }),
      response: {
        200: z.object({ ok: z.boolean() }),
        401: z.object({ message: z.string() }),
        403: z.object({ message: z.string() }),
      },
    },
  }, async (request, reply) => {
    const { authService } = await import('../auth/auth.service');
    const context = await authService.getContext(request.user.userId);
    if (!context) return reply.code(401).send({ message: 'Unauthorized' });
    if (!managerRoles.includes(context.user.role as typeof managerRoles[number])) {
      return reply.code(403).send({ message: 'Managers and above only' });
    }

    await regionRepository.assignStaffRegion(
      request.params.companyUserId,
      request.body.regionId,
      context.company.id
    );
    return { ok: true };
  });
}
