import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { shopRepository } from './shops.repository';
import { 
  shopSchema, 
  createShopSchema, 
  updateShopSchema, 
  listShopsQuerySchema 
} from './shops.schema';

export async function shopsRoutes(app: FastifyInstance) {
    app.addHook('onRequest', async (request, reply) => {
        try {
            await request.jwtVerify();
        } catch (err) {
            reply.send(err);
        }
    });

    // List
    app.withTypeProvider<ZodTypeProvider>().get('/', {
        schema: {
            querystring: listShopsQuerySchema,
            response: {
                200: z.object({ ok: z.boolean(), shops: z.array(shopSchema) }),
                401: z.object({ message: z.string() }),
                501: z.object({ message: z.string() })
            }
        }
    }, async (request, reply) => {
        const { user } = request;
        const { authService } = await import('../auth/auth.service');
        const context = await authService.getContext(user.userId);
        if (!context) return reply.code(401).send({ message: 'Unauthorized' });

        const shops = await shopRepository.findAll({
            companyId: context.company.id,
            ...request.query
        });
        return { ok: true, shops };
    });

    // Create
    app.withTypeProvider<ZodTypeProvider>().post('/', {
        schema: {
            body: createShopSchema,
            response: {
                201: z.object({ ok: z.boolean(), shop: shopSchema }),
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

        const shop = await shopRepository.create({
            companyId: context.company.id,
            ...request.body
        });

        return reply.code(201).send({ ok: true, shop });
    });

    // Get Shop
    app.withTypeProvider<ZodTypeProvider>().get('/:shopId', {
        schema: {
            params: z.object({ shopId: z.string().uuid() }),
            response: {
                200: z.object({ ok: z.boolean(), shop: shopSchema }),
                404: z.object({ message: z.string() }),
                401: z.object({ message: z.string() })
            }
        }
    }, async (request, reply) => {
        const { user } = request;
        const { authService } = await import('../auth/auth.service');
        const context = await authService.getContext(user.userId);
        if (!context) return reply.code(401).send({ message: 'Unauthorized' });

        const shop = await shopRepository.findById(request.params.shopId, context.company.id);
        if (!shop) return reply.code(404).send({ message: 'Shop not found' });

        return { ok: true, shop };
    });

    // Update Shop
    app.withTypeProvider<ZodTypeProvider>().patch('/:shopId', {
        schema: {
            params: z.object({ shopId: z.string().uuid() }),
            body: updateShopSchema,
            response: {
                200: z.object({ ok: z.boolean(), shop: shopSchema }),
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
        
        if (context.user.role === 'rep') return reply.code(403).send({ message: 'Forbidden' });

        const shop = await shopRepository.update(request.params.shopId, context.company.id, request.body);
        if (!shop) return reply.code(404).send({ message: 'Shop not found' });

        return { ok: true, shop };
    });
}
