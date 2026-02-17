import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { orderRepository } from './orders.repository';
import { 
  orderSchema, 
  createOrderSchema, 
  updateOrderSchema, 
  listOrdersQuerySchema,
  cancelOrderSchema
} from './orders.schema';

export async function ordersRoutes(app: FastifyInstance) {
    app.addHook('onRequest', async (request, reply) => {
        try {
            await request.jwtVerify();
        } catch (err) {
            reply.send(err);
        }
    });

    // List Orders
    app.withTypeProvider<ZodTypeProvider>().get('/', {
        schema: {
            querystring: listOrdersQuerySchema,
            response: {
                200: z.object({ ok: z.boolean(), orders: z.array(orderSchema) }),
                401: z.object({ message: z.string() }),
                501: z.object({ message: z.string() })
            }
        }
    }, async (request, reply) => {
        const { user } = request;
        const { authService } = await import('../auth/auth.service');
        const context = await authService.getContext(user.userId);
        if (!context) return reply.code(401).send({ message: 'Unauthorized' } as any);

        let repId = request.query.rep;
        if (context.user.role === 'rep') {
            repId = context.user.companyUserId;
        }

        const orders = await orderRepository.findAll({
            companyId: context.company.id,
            status: request.query.status,
            q: request.query.q,
            shopId: request.query.shop,
            repId: repId,
            dateFrom: request.query.date_from,
            dateTo: request.query.date_to
        });

        return { ok: true, orders };
    });

    // Get Counts
    app.withTypeProvider<ZodTypeProvider>().get('/counts', {
        schema: {
            response: {
                200: z.object({ 
                    ok: z.boolean(), 
                    counts: z.object({
                        received: z.number(),
                        processing: z.number(),
                        shipped: z.number(),
                        closed: z.number(),
                        cancelled: z.number()
                    }) 
                }),
                401: z.object({ message: z.string() })
            }
        }
    }, async (request, reply) => {
        const { user } = request;
        const { authService } = await import('../auth/auth.service');
        const context = await authService.getContext(user.userId);
        if (!context) return reply.code(401).send({ message: 'Unauthorized' } as any);

        const counts = await orderRepository.getCounts(context.company.id);
        return { ok: true, counts };
    });

    // Create Order
    app.withTypeProvider<ZodTypeProvider>().post('/', {
        schema: {
            body: createOrderSchema,
            response: {
                201: z.object({ ok: z.boolean(), order: orderSchema }),
                401: z.object({ message: z.string() })
            }
        }
    }, async (request, reply) => {
        const { user } = request;
        const { authService } = await import('../auth/auth.service');
        const context = await authService.getContext(user.userId);
        if (!context) return reply.code(401).send({ message: 'Unauthorized' } as any);

        const order = await orderRepository.create({
            companyId: context.company.id,
            placedByCompanyUserId: context.user.companyUserId,
            ...request.body
        });

        return reply.code(201).send({ ok: true, order });
    });

    // Get Order
    app.withTypeProvider<ZodTypeProvider>().get('/:orderId', {
        schema: {
            params: z.object({ orderId: z.string().uuid() }),
            response: {
                200: z.object({ ok: z.boolean(), order: orderSchema }),
                404: z.object({ message: z.string() }),
                401: z.object({ message: z.string() })
            }
        }
    }, async (request, reply) => {
        const { user } = request;
         const { authService } = await import('../auth/auth.service');
        const context = await authService.getContext(user.userId);
        if (!context) return reply.code(401).send({ message: 'Unauthorized' } as any);

        const order = await orderRepository.findById(request.params.orderId, context.company.id);
        if (!order) return reply.code(404).send({ message: 'Order not found' });
        
        if (context.user.role === 'rep' && order.placed_by_company_user_id !== context.user.companyUserId) {
            // Reps typically strictly see only their own orders or orders for their shops?
            // Doc says: "reps see only orders they placed".
            return reply.code(404).send({ message: 'Order not found' });
        }

        return { ok: true, order };
    });
    
    // Cancel Order
    app.withTypeProvider<ZodTypeProvider>().post('/:orderId/cancel', {
        schema: {
            params: z.object({ orderId: z.string().uuid() }),
            body: cancelOrderSchema,
            response: {
                200: z.object({ ok: z.boolean(), order: orderSchema }),
                404: z.object({ message: z.string() }),
                401: z.object({ message: z.string() }),
                400: z.object({ message: z.string() }),
                501: z.object({ message: z.string() })
            }
        }
    }, async (request, reply) => {
         const { user } = request;
         const { authService } = await import('../auth/auth.service');
        const context = await authService.getContext(user.userId);
        if (!context) return reply.code(401).send({ message: 'Unauthorized' } as any);

        const order = await orderRepository.findById(request.params.orderId, context.company.id);
        if (!order) return reply.code(404).send({ message: 'Order not found' });
        
        if (order.status !== 'received' && order.status !== 'processing') {
             return reply.code(400).send({ message: 'Cannot cancel order in current status' });
        }

        const cancelledOrder = await orderRepository.cancel(
            request.params.orderId, 
            context.company.id, 
            request.body.cancel_reason || null, 
            request.body.cancel_note || null
        );
        
        if (!cancelledOrder) return reply.code(404).send({ message: 'Order not found' });

        return { ok: true, order: cancelledOrder };
    });
}
