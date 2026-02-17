import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { visitRepository } from './visits.repository';
import { 
  visitSchema, 
  createVisitSchema, 
  updateVisitSchema,
  listVisitsQuerySchema 
} from './visits.schema';

export async function visitsRoutes(app: FastifyInstance) {
    app.addHook('onRequest', async (request, reply) => {
        try {
            await request.jwtVerify();
        } catch (err) {
            reply.send(err);
        }
    });

    // List Visits
    app.withTypeProvider<ZodTypeProvider>().get('/', {
        schema: {
            querystring: listVisitsQuerySchema,
            response: {
                200: z.object({ ok: z.boolean(), visits: z.array(visitSchema) }),
                401: z.object({ message: z.string() })
            }
        }
    }, async (request, reply) => {
        const { user } = request;
        const { authService } = await import('../auth/auth.service');
        const context = await authService.getContext(user.userId);
        if (!context) return reply.code(401).send({ message: 'Unauthorized' });

        let repId = request.query.rep;
        if (context.user.role === 'rep') {
            repId = context.user.companyUserId;
        }

        const visits = await visitRepository.findAll({
            companyId: context.company.id,
            repId: repId,
            shopId: request.query.shop,
            dateFrom: request.query.date_from,
            dateTo: request.query.date_to
        });

        return { ok: true, visits };
    });

    // Create Visit
    app.withTypeProvider<ZodTypeProvider>().post('/', {
        schema: {
            body: createVisitSchema,
            response: {
                201: z.object({ ok: z.boolean(), visit: visitSchema }),
                401: z.object({ message: z.string() })
            }
        }
    }, async (request, reply) => {
        const { user } = request;
        const { authService } = await import('../auth/auth.service');
        const context = await authService.getContext(user.userId);
        if (!context) return reply.code(401).send({ message: 'Unauthorized' });

        const visit = await visitRepository.create({
            companyId: context.company.id,
            repCompanyUserId: context.user.companyUserId,
            ...request.body
        });

        return reply.code(201).send({ ok: true, visit });
    });

    // Update Visit
    app.withTypeProvider<ZodTypeProvider>().patch('/:visitId', {
        schema: {
            params: z.object({ visitId: z.string().uuid() }),
            body: updateVisitSchema,
            response: {
                200: z.object({ ok: z.boolean(), visit: visitSchema }),
                404: z.object({ message: z.string() }),
                401: z.object({ message: z.string() }),
                403: z.object({ message: z.string() })
            }
        }
    }, async (request, reply) => {
        const { user } = request;
        const { authService } = await import('../auth/auth.service');
        const context = await authService.getContext(user.userId);
        if (!context) return reply.code(401).send({ message: 'Unauthorized' });

        const currentVisit = await visitRepository.findById(request.params.visitId, context.company.id);
        if (!currentVisit) return reply.code(404).send({ message: 'Visit not found' });
        
        // Rep can only update their own visits
        if (context.user.role === 'rep' && currentVisit.rep_company_user_id !== context.user.companyUserId) {
            return reply.code(403).send({ message: 'Forbidden' });
        }

        const updateData = { ...request.body };
        if (updateData.end) {
            updateData.status = 'completed';
        }

        const visit = await visitRepository.update(request.params.visitId, context.company.id, updateData);
        if (!visit) return reply.code(404).send({ message: 'Visit not found' });

        return { ok: true, visit };
    });
}
