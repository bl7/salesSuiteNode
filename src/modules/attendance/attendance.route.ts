import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { attendanceRepository } from './attendance.repository';
import { 
  clockInSchema, 
  clockOutSchema, 
  getAttendanceQuerySchema,
  attendanceLogResponseSchema,
  attendanceListResponseSchema
} from './attendance.schema';
import { z } from 'zod';

export async function attendanceRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });

  // Clock In
  app.withTypeProvider<ZodTypeProvider>().post('/clock-in', {
    schema: {
      body: clockInSchema,
      response: {
        201: z.object({ ok: z.boolean(), log: attendanceLogResponseSchema }),
        400: z.object({ message: z.string() }),
        401: z.object({ message: z.string() })
      }
    }
  }, async (request, reply) => {
    const { user } = request;
    const { authService } = await import('../auth/auth.service');
    const context = await authService.getContext(user.userId);
    
    if (!context) return reply.code(401).send({ message: 'Unauthorized' });

    const activeLog = await attendanceRepository.findActiveLog(context.user.companyUserId);
    if (activeLog) {
      return reply.code(400).send({ message: 'Already clocked in' });
    }

    const log = await attendanceRepository.create({
      companyId: context.company.id,
      repCompanyUserId: context.user.companyUserId,
      latitude: request.body.latitude,
      longitude: request.body.longitude,
      notes: request.body.notes
    });

    return reply.code(201).send({ ok: true, log });
  });

  // Clock Out
  app.withTypeProvider<ZodTypeProvider>().post('/clock-out', {
    schema: {
      body: clockOutSchema,
      response: {
        200: z.object({ ok: z.boolean(), log: attendanceLogResponseSchema }),
        400: z.object({ message: z.string() }),
        401: z.object({ message: z.string() })
      }
    }
  }, async (request, reply) => {
    const { user } = request;
    const { authService } = await import('../auth/auth.service');
    const context = await authService.getContext(user.userId);
    if (!context) return reply.code(401).send({ message: 'Unauthorized' });

    const activeLog = await attendanceRepository.findActiveLog(context.user.companyUserId);
    if (!activeLog) {
      return reply.code(400).send({ message: 'Not clocked in' });
    }

    const log = await attendanceRepository.updateClockOut(activeLog.id, {
      latitude: request.body.latitude,
      longitude: request.body.longitude,
      notes: request.body.notes
    });

    return { ok: true, log };
  });

  // List
  app.withTypeProvider<ZodTypeProvider>().get('/', {
    schema: {
      querystring: getAttendanceQuerySchema,
      response: {
        200: attendanceListResponseSchema,
        401: z.object({ message: z.string() })
      }
    }
  }, async (request, reply) => {
    const { user } = request;
    const { authService } = await import('../auth/auth.service');
    const context = await authService.getContext(user.userId);
    if (!context) return reply.code(401).send({ message: 'Unauthorized' });

    // If rep, force filter by self
    let filterRepId = request.query.rep;
    if (context.user.role === 'rep') {
      filterRepId = context.user.companyUserId;
    }

    const logs = await attendanceRepository.findAll({
      companyId: context.company.id,
      repCompanyUserId: filterRepId,
      dateFrom: request.query.date_from,
      dateTo: request.query.date_to
    });

    return { ok: true, logs };
  });
}
