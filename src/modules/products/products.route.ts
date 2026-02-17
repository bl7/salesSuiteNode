import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { productRepository } from './products.repository';
import { 
  productSchema, 
  createProductSchema, 
  updateProductSchema, 
  listProductsQuerySchema, 
  setPriceSchema 
} from './products.schema';

export async function productsRoutes(app: FastifyInstance) {
    app.addHook('onRequest', async (request, reply) => {
        try {
            await request.jwtVerify();
        } catch (err) {
            reply.send(err);
        }
    });

    // List Products
    app.withTypeProvider<ZodTypeProvider>().get('/', {
        schema: {
            querystring: listProductsQuerySchema,
            response: {
                200: z.object({ ok: z.boolean(), products: z.array(productSchema) }),
                401: z.object({ message: z.string() })
            }
        }
    }, async (request, reply) => {
        const { user } = request;
        const { authService } = await import('../auth/auth.service');
        const context = await authService.getContext(user.userId);
        if (!context) return reply.code(401).send({ message: 'Unauthorized' } as any);

        const products = await productRepository.findAll(context.company.id, request.query);
        return { ok: true, products };
    });

    // Create Product
    app.withTypeProvider<ZodTypeProvider>().post('/', {
        schema: {
            body: createProductSchema,
            response: {
                201: z.object({ ok: z.boolean(), product: productSchema }),
                401: z.object({ message: z.string() }),
                403: z.object({ message: z.string() })
            }
        }
    }, async (request, reply) => {
        const { user } = request;
        const { authService } = await import('../auth/auth.service');
        const context = await authService.getContext(user.userId);
        if (!context) return reply.code(401).send({ message: 'Unauthorized' } as any); // Added cast to fix potential lint
        if (context.user.role === 'rep') return reply.code(403).send({ message: 'Forbidden' } as any);

        const product = await productRepository.create({
            companyId: context.company.id,
            ...request.body
        });

        return reply.code(201).send({ ok: true, product });
    });

    // Get Product
    app.withTypeProvider<ZodTypeProvider>().get('/:productId', {
        schema: {
            params: z.object({ productId: z.string().uuid() }),
            response: {
                200: z.object({ ok: z.boolean(), product: productSchema }),
                404: z.object({ message: z.string() }),
                401: z.object({ message: z.string() })
            }
        }
    }, async (request, reply) => {
        const { user } = request;
        const { authService } = await import('../auth/auth.service');
        const context = await authService.getContext(user.userId);
        if (!context) return reply.code(401).send({ message: 'Unauthorized' } as any);

        const product = await productRepository.findById(request.params.productId, context.company.id);
        if (!product) return reply.code(404).send({ message: 'Product not found' });

        return { ok: true, product };
    });

    // Update Product
    app.withTypeProvider<ZodTypeProvider>().patch('/:productId', {
        schema: {
            params: z.object({ productId: z.string().uuid() }),
            body: updateProductSchema,
            response: {
                200: z.object({ ok: z.boolean(), product: productSchema }),
                404: z.object({ message: z.string() }),
                401: z.object({ message: z.string() }),
                403: z.object({ message: z.string() })
            }
        }
    }, async (request, reply) => {
        const { user } = request;
        const { authService } = await import('../auth/auth.service');
        const context = await authService.getContext(user.userId);
        if (!context) return reply.code(401).send({ message: 'Unauthorized' } as any);
        if (context.user.role === 'rep') return reply.code(403).send({ message: 'Forbidden' } as any);

        const product = await productRepository.update(request.params.productId, context.company.id, request.body);
        if (!product) return reply.code(404).send({ message: 'Product not found' });

        return { ok: true, product };
    });

    // Delete Product
    app.withTypeProvider<ZodTypeProvider>().delete('/:productId', {
        schema: {
            params: z.object({ productId: z.string().uuid() }),
            response: {
                200: z.object({ ok: z.boolean(), deleted: z.boolean() }),
                400: z.object({ message: z.string() }),
                404: z.object({ message: z.string() }),
                401: z.object({ message: z.string() }),
                403: z.object({ message: z.string() })
            }
        }
    }, async (request, reply) => {
        const { user } = request;
        const { authService } = await import('../auth/auth.service');
        const context = await authService.getContext(user.userId);
        if (!context) return reply.code(401).send({ message: 'Unauthorized' } as any);
        if (context.user.role === 'rep') return reply.code(403).send({ message: 'Forbidden' } as any);

        const deleted = await productRepository.delete(request.params.productId, context.company.id);
        if (!deleted) {
            // Check if it exists at all
            const p = await productRepository.findById(request.params.productId, context.company.id);
            if (!p) return reply.code(404).send({ message: 'Product not found' });
            return reply.code(400).send({ message: 'Cannot delete product used in orders' });
        }

        return { ok: true, deleted: true };
    });

    // Set Price
    app.withTypeProvider<ZodTypeProvider>().post('/:productId/prices', {
        schema: {
            params: z.object({ productId: z.string().uuid() }),
            body: setPriceSchema,
            response: {
                201: z.object({ 
                    ok: z.boolean(), 
                    price: z.object({ 
                        id: z.string(), 
                        product_id: z.string(), 
                        price: z.string().or(z.number()), 
                        currency_code: z.string(),
                        starts_at: z.date(),
                        ends_at: z.date().nullable().optional()
                    }) 
                }),
                401: z.object({ message: z.string() }),
                403: z.object({ message: z.string() })
            }
        }
    }, async (request, reply) => {
        const { user } = request;
        const { authService } = await import('../auth/auth.service');
        const context = await authService.getContext(user.userId);
        if (!context) return reply.code(401).send({ message: 'Unauthorized' } as any);
        if (context.user.role === 'rep') return reply.code(403).send({ message: 'Forbidden' } as any);

        const price = await productRepository.setPrice(
            request.params.productId, 
            context.company.id, 
            request.body.price, 
            request.body.currencyCode
        );

        return reply.code(201).send({ ok: true, price });
    });
}
