import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { reportsRepository } from './reports.repository';
import { coverageReportQuerySchema, coverageReportResponseSchema, atRiskShopsResponseSchema, leaderboardResponseSchema, unvisitedShopsQuerySchema, unvisitedShopsResponseSchema, flaggedRepsResponseSchema } from './reports.schema';

export async function reportsRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });

  app.withTypeProvider<ZodTypeProvider>().get('/coverage', {
    schema: {
      querystring: coverageReportQuerySchema,
      response: {
        200: coverageReportResponseSchema,
        401: z.object({ message: z.string() }),
        403: z.object({ message: z.string() })
      }
    }
  }, async (request, reply) => {
    const { user } = request;
    const { authService } = await import('../auth/auth.service');
    const context = await authService.getContext(user.userId);
    if (!context) return reply.code(401).send({ message: 'Unauthorized' });

    if (context.user.role === 'rep') {
        return reply.code(403).send({ message: 'Forbidden' });
    }

    const now = new Date();
    let from = new Date();
    from.setDate(now.getDate() - 7); // Default last 7 days
    let to = new Date();

    if (request.query.dateFrom) {
        from = new Date(request.query.dateFrom);
    }
    if (request.query.dateTo) {
        to = new Date(request.query.dateTo);
        // Ensure "to" date includes the full day if it was just YYYY-MM-DD
        if (request.query.dateTo.length === 10) {
           to.setHours(23, 59, 59, 999);
        }
    } else {
        // If defaulting to "now", ensure it covers until end of day? 
        // Actually "now" is fine, or set to end of today.
        to.setHours(23, 59, 59, 999);
    }
    
    // If "from" was just YYYY-MM-DD (length 10), ensure start of day
    if (request.query.dateFrom && request.query.dateFrom.length === 10) {
        from.setHours(0, 0, 0, 0);
    } else if (!request.query.dateFrom) {
        from.setHours(0, 0, 0, 0);
    }
    
    const report = await reportsRepository.getCoverageReport(context.company.id, from, to, request.query.region);
    
    return { ok: true, report };
  });

  // At-Risk Shops
  app.withTypeProvider<ZodTypeProvider>().get('/at-risk', {
    schema: {
      response: {
        200: atRiskShopsResponseSchema,
        401: z.object({ message: z.string() }),
        403: z.object({ message: z.string() })
      }
    }
  }, async (request, reply) => {
    const { user } = request;
    const { authService } = await import('../auth/auth.service');
    const context = await authService.getContext(user.userId);
    if (!context) return reply.code(401).send({ message: 'Unauthorized' });
    if (context.user.role === 'rep') return reply.code(403).send({ message: 'Forbidden' });

    const shops = await reportsRepository.getAtRiskShops(context.company.id);
    return { ok: true, shops };
  });

  // Rep Leaderboard
  app.withTypeProvider<ZodTypeProvider>().get('/leaderboard', {
    schema: {
      response: {
        200: leaderboardResponseSchema,
        401: z.object({ message: z.string() }),
        403: z.object({ message: z.string() })
      }
    }
  }, async (request, reply) => {
    const { user } = request;
    const { authService } = await import('../auth/auth.service');
    const context = await authService.getContext(user.userId);
    if (!context) return reply.code(401).send({ message: 'Unauthorized' });
    if (context.user.role === 'rep') return reply.code(403).send({ message: 'Forbidden' });

    const reps = await reportsRepository.getLeaderboard(context.company.id);
    return { ok: true, reps };
  });

  // Shops Not Visited in X Days
  app.withTypeProvider<ZodTypeProvider>().get('/unvisited', {
    schema: {
      querystring: unvisitedShopsQuerySchema,
      response: {
        200: unvisitedShopsResponseSchema,
        401: z.object({ message: z.string() }),
        403: z.object({ message: z.string() })
      }
    }
  }, async (request, reply) => {
    const { user } = request;
    const { authService } = await import('../auth/auth.service');
    const context = await authService.getContext(user.userId);
    if (!context) return reply.code(401).send({ message: 'Unauthorized' });
    if (context.user.role === 'rep') return reply.code(403).send({ message: 'Forbidden' });

    const days = parseInt(request.query.days || '7', 10);
    const repId = request.query.rep;
    const shops = await reportsRepository.getUnvisitedShops(context.company.id, days, repId, request.query.region);
    return { ok: true, shops, days, total: shops.length };
  });

  // Flagged Reps — auto-detected abnormal behavior
  app.withTypeProvider<ZodTypeProvider>().get('/flagged', {
    schema: {
      response: {
        200: flaggedRepsResponseSchema,
        401: z.object({ message: z.string() }),
        403: z.object({ message: z.string() })
      }
    }
  }, async (request, reply) => {
    const { user } = request;
    const { authService } = await import('../auth/auth.service');
    const context = await authService.getContext(user.userId);
    if (!context) return reply.code(401).send({ message: 'Unauthorized' });
    if (context.user.role === 'rep') return reply.code(403).send({ message: 'Forbidden' });

    const flagged = await reportsRepository.getFlaggedReps(context.company.id);
    return { ok: true, flagged };
  });
}
