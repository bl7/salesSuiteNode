import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { shopAssignmentRepository } from './shop-assignments.repository';
import { shopAssignmentSchema, createAssignmentSchema } from './shop-assignments.schema';
import { shopRepository } from './shops.repository';

export async function shopAssignmentsRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });

  // List Assignments
  app.withTypeProvider<ZodTypeProvider>().get('/', {
    schema: {
      response: {
        200: z.object({ ok: z.boolean(), assignments: z.array(shopAssignmentSchema) }),
        401: z.object({ message: z.string() })
      }
    }
  }, async (request, reply) => {
    const { user } = request;
    const { authService } = await import('../auth/auth.service');
    const context = await authService.getContext(user.userId);
    if (!context) return reply.code(401).send({ message: 'Unauthorized' });

    const assignments = await shopAssignmentRepository.findAll(context.company.id);
    return { ok: true, assignments };
  });

  // Upsert Assignment
  app.withTypeProvider<ZodTypeProvider>().post('/', {
    schema: {
      body: createAssignmentSchema,
      response: {
        201: z.object({ ok: z.boolean(), assignment: shopAssignmentSchema }),
        400: z.object({ message: z.string() }),
        401: z.object({ message: z.string() }),
        403: z.object({ message: z.string() }),
        404: z.object({ message: z.string() })
      }
    }
  }, async (request, reply) => {
    const { user } = request;
    const { authService } = await import('../auth/auth.service');
    const context = await authService.getContext(user.userId);
    if (!context) return reply.code(401).send({ message: 'Unauthorized' });

    if (context.user.role === 'rep') return reply.code(403).send({ message: 'Forbidden' } as any);

    // Verify shop exists
    const shop = await shopRepository.findById(request.body.shopId, context.company.id);
    if (!shop) return reply.code(404).send({ message: 'Shop not found' });

    const assignment = await shopAssignmentRepository.upsert({
      companyId: context.company.id,
      ...request.body
    });

    return reply.code(201).send({ ok: true, assignment });
  });

  // Delete Assignment
  app.withTypeProvider<ZodTypeProvider>().delete('/:assignmentId', {
    schema: {
      params: z.object({ assignmentId: z.string().uuid() }),
      response: {
        200: z.object({ ok: z.boolean(), message: z.string() }),
        401: z.object({ message: z.string() }),
        403: z.object({ message: z.string() }),
        404: z.object({ message: z.string() })
      }
    }
  }, async (request, reply) => {
    const { user } = request;
    const { authService } = await import('../auth/auth.service');
    const context = await authService.getContext(user.userId);
    if (!context) return reply.code(401).send({ message: 'Unauthorized' });

    if (context.user.role === 'rep') return reply.code(403).send({ message: 'Forbidden' } as any);

    const deleted = await shopAssignmentRepository.delete(request.params.assignmentId, context.company.id);
    if (!deleted) return reply.code(404).send({ message: 'Assignment not found' });

    return { ok: true, message: 'Assignment deleted' };
  });
}
