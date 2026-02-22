import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { dailyActivitySyncSchema, getActivityStatsQuerySchema } from './activity.schema';
import { activityRepository } from './activity.repository';

export async function activityRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  // Sync daily activity (called on clock-out or periodically)
  typedApp.post('/daily', {
    schema: {
      body: dailyActivitySyncSchema,
    },
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const { authService } = await import('../auth/auth.service');
    const context = await authService.getContext(req.user.userId);
    if (!context) return reply.status(401).send({ message: 'Unauthorized' });

    const { companyUserId } = context.user;
    const companyId = context.company.id;

    const result = await activityRepository.upsert({
      companyId,
      repCompanyUserId: companyUserId,
      ...req.body
    });

    return { ok: true, activity: result };
  });

  // Get activity logs (Manager view)
  typedApp.get('/', {
    schema: {
      querystring: getActivityStatsQuerySchema,
    },
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const { authService } = await import('../auth/auth.service');
    const context = await authService.getContext(req.user.userId);
    if (!context) return reply.status(401).send({ message: 'Unauthorized' });

    const { id: companyId } = context.company;
    const { role, companyUserId } = context.user;
    const { rep, date_from, date_to } = req.query;

    let targetRepId = rep;
    if (role !== 'manager' && role !== 'boss') {
      targetRepId = companyUserId;
    }

    const logs = await activityRepository.findAll({
      companyId,
      repCompanyUserId: targetRepId,
      dateFrom: date_from,
      dateTo: date_to,
    });

    return { ok: true, logs };
  });
}
