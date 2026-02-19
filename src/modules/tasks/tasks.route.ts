import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { taskRepository } from './tasks.repository';
import { 
  taskSchema, 
  createTaskSchema, 
  updateTaskSchema, 
  listTasksQuerySchema 
} from './tasks.schema';

export async function tasksRoutes(app: FastifyInstance) {
    app.addHook('onRequest', async (request, reply) => {
        try {
            await request.jwtVerify();
        } catch (err) {
            reply.send(err);
        }
    });

    // List Tasks
    app.withTypeProvider<ZodTypeProvider>().get('/', {
        schema: {
            querystring: listTasksQuerySchema,
            response: {
                200: z.object({ ok: z.boolean(), tasks: z.array(taskSchema) }),
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

        const tasks = await taskRepository.findAll({
            companyId: context.company.id,
            status: request.query.status,
            assignedToId: repId,
            dateFrom: request.query.date_from,
            dateTo: request.query.date_to
        });

        return { ok: true, tasks };
    });

    // Create Task
    app.withTypeProvider<ZodTypeProvider>().post('/', {
        schema: {
            body: createTaskSchema,
            response: {
                201: z.object({ ok: z.boolean(), task: taskSchema }),
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

        const task = await taskRepository.create({
            companyId: context.company.id,
            createdByCompanyUserId: context.user.companyUserId,
            title: request.body.title,
            assignedToCompanyUserId: request.body.repCompanyUserId,
            description: request.body.description,
            dueDate: request.body.dueAt ? new Date(request.body.dueAt) : undefined,
            leadId: request.body.leadId,
            shopId: request.body.shopId
        });

        return reply.code(201).send({ ok: true, task: task as any });
    });

    // Update Task
    app.withTypeProvider<ZodTypeProvider>().patch('/:taskId', {
        schema: {
            params: z.object({ taskId: z.string().uuid() }),
            body: updateTaskSchema,
            response: {
                200: z.object({ ok: z.boolean(), task: taskSchema }),
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

        const currentTask = await taskRepository.findById(request.params.taskId, context.company.id);
        if (!currentTask) return reply.code(404).send({ message: 'Task not found' });

        // Reps can only update status of their own tasks
        if (context.user.role === 'rep') {
            if (currentTask.rep_company_user_id !== context.user.companyUserId) {
                return reply.code(403).send({ message: 'Forbidden' });
            }
        }

        const updatedTask = await taskRepository.update(request.params.taskId, context.company.id, {
            title: request.body.title,
            description: request.body.description,
            status: request.body.status,
            dueDate: request.body.dueAt === null ? null : (request.body.dueAt ? new Date(request.body.dueAt) : undefined),
            leadId: request.body.leadId,
            shopId: request.body.shopId
        });
        
        if (!updatedTask) return reply.code(404).send({ message: 'Task not found' });

        return { ok: true, task: updatedTask as any };
    });

    // Mark Task Complete
    app.withTypeProvider<ZodTypeProvider>().post('/:taskId/complete', {
        schema: {
            params: z.object({ taskId: z.string().uuid() }),
            response: {
                200: z.object({ ok: z.boolean() }),
                401: z.object({ message: z.string() }),
                404: z.object({ message: z.string() })
            }
        }
    }, async (request, reply) => {
        const { user } = request;
        const { authService } = await import('../auth/auth.service');
        const context = await authService.getContext(user.userId);
        if (!context) return reply.code(401).send({ message: 'Unauthorized' });

        const updated = await taskRepository.update(request.params.taskId, context.company.id, {
            status: 'completed'
        });

        if (!updated) return reply.code(404).send({ message: 'Task not found' });
        return { ok: true };
    });
}
