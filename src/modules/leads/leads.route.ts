import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { leadsRepository } from './leads.repository';
import { shopRepository } from '../shops/shops.repository';
import { 
  leadSchema, 
  createLeadSchema, 
  updateLeadSchema, 
  listLeadsQuerySchema,
  convertToShopResponseSchema 
} from './leads.schema';
import { pool } from '../../db/pool';

export async function leadsRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });

  // List Leads
  app.withTypeProvider<ZodTypeProvider>().get('/', {
    schema: {
      querystring: listLeadsQuerySchema,
      response: {
        200: z.object({ ok: z.boolean(), leads: z.array(leadSchema) }),
        401: z.object({ message: z.string() })
      }
    }
  }, async (request, reply) => {
    const { user } = request;
    const { authService } = await import('../auth/auth.service');
    const context = await authService.getContext(user.userId);
    if (!context) return reply.code(401).send({ message: 'Unauthorized' });

    let createdById = undefined;
    if (context.user.role === 'rep') {
        createdById = context.user.companyUserId;
    }

    const leads = await leadsRepository.findAll({
      companyId: context.company.id,
      status: request.query.status,
      q: request.query.q,
      createdById: createdById
    });

    return { ok: true, leads };
  });

  // Create Lead
  app.withTypeProvider<ZodTypeProvider>().post('/', {
    schema: {
      body: createLeadSchema,
      response: {
        201: z.object({ ok: z.boolean(), lead: leadSchema }),
        401: z.object({ message: z.string() })
      }
    }
  }, async (request, reply) => {
    const { user } = request;
    const { authService } = await import('../auth/auth.service');
    const context = await authService.getContext(user.userId);
    if (!context) return reply.code(401).send({ message: 'Unauthorized' });

    const lead = await leadsRepository.create({
      companyId: context.company.id,
      createdByCompanyUserId: context.user.companyUserId,
      ...request.body
    });

    return reply.code(201).send({ ok: true, lead });
  });

  // Get Lead
  app.withTypeProvider<ZodTypeProvider>().get('/:leadId', {
    schema: {
        params: z.object({ leadId: z.string().uuid() }),
        response: {
            200: z.object({ ok: z.boolean(), lead: leadSchema }),
            404: z.object({ message: z.string() }),
            401: z.object({ message: z.string() })
        }
    }
  }, async (request, reply) => {
      const { user } = request;
      const { authService } = await import('../auth/auth.service');
      const context = await authService.getContext(user.userId);
      if (!context) return reply.code(401).send({ message: 'Unauthorized' });

      const lead = await leadsRepository.findById(request.params.leadId, context.company.id);
      if (!lead) return reply.code(404).send({ message: 'Lead not found' });
      
      // Access check? Reps see only theirs? Doc says "reps see only leads they created" for LIST.
      // But for DETAIL? Usually implies same restriction.
      if (context.user.role === 'rep' && lead.created_by_company_user_id !== context.user.companyUserId) {
          // Unless assigned to them? The doc says "reps see only leads they created" under LIST.
          // Let's assume strict ownership or assignment.
          if (lead.assigned_rep_company_user_id !== context.user.companyUserId) {
             return reply.code(404).send({ message: 'Lead not found' });
          }
      }

      return { ok: true, lead };
  });

  // Update Lead
  app.withTypeProvider<ZodTypeProvider>().patch('/:leadId', {
      schema: {
          params: z.object({ leadId: z.string().uuid() }),
          body: updateLeadSchema,
          response: {
              200: z.object({ ok: z.boolean(), lead: leadSchema }),
              404: z.object({ message: z.string() }),
              401: z.object({ message: z.string() })
          }
      }
  }, async (request, reply) => {
      const { user } = request;
      const { authService } = await import('../auth/auth.service');
      const context = await authService.getContext(user.userId);
      if (!context) return reply.code(401).send({ message: 'Unauthorized' });

      // Check existence and permissions
      const currentLead = await leadsRepository.findById(request.params.leadId, context.company.id);
      if (!currentLead) return reply.code(404).send({ message: 'Lead not found' });

      if (context.user.role === 'rep' && 
          currentLead.created_by_company_user_id !== context.user.companyUserId && 
          currentLead.assigned_rep_company_user_id !== context.user.companyUserId) {
           return reply.code(404).send({ message: 'Lead not found' });
      }

      const updatedLead = await leadsRepository.update(request.params.leadId, context.company.id, request.body);
      
      // If we fetched currentLead, updatedLead should exist
      if (!updatedLead) return reply.code(404).send({ message: 'Lead not found' }); 

      return { ok: true, lead: updatedLead };
  });
  
  // Convert to Shop
  app.withTypeProvider<ZodTypeProvider>().post('/:leadId/convert-to-shop', {
      schema: {
          params: z.object({ leadId: z.string().uuid() }),
           response: {
              201: convertToShopResponseSchema,
              400: z.object({ message: z.string() }),
              404: z.object({ message: z.string() }),
              401: z.object({ message: z.string() }),
              500: z.object({ message: z.string(), error: z.string().optional() })
          } 
      }
  }, async (request, reply) => {
       const { user } = request;
      const { authService } = await import('../auth/auth.service');
      const context = await authService.getContext(user.userId);
      if (!context) return reply.code(401).send({ message: 'Unauthorized' });
      
      if (context.user.role !== 'boss' && context.user.role !== 'manager') {
           return reply.code(401).send({ message: 'Insufficient permissions' });
      }

      const lead = await leadsRepository.findById(request.params.leadId, context.company.id);
      if (!lead) return reply.code(404).send({ message: 'Lead not found' });
      if (lead.shop_id) return reply.code(400).send({ message: 'Lead already converted to shop' });

      // Transaction
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // 1. Create Shop
        const newShop = await shopRepository.create({
            companyId: context.company.id,
            name: lead.name,
            latitude: lead.latitude ?? undefined, 
            longitude: lead.longitude ?? undefined, 
            geofenceRadiusM: 100,
            notes: `Converted from lead ${lead.id}`
        }, client);
        
        // 2. Update Lead
        await leadsRepository.update(lead.id, context.company.id, {
            status: 'converted',
            convertedAt: new Date(),
            shopId: newShop.id
        }, client);
        
        await client.query('COMMIT');
        
        return reply.code(201).send({ 
            ok: true, 
            shop: { 
                id: newShop.id, 
                name: newShop.name, 
                latitude: newShop.latitude, 
                longitude: newShop.longitude 
            } 
        });
      } catch (e) {
        await client.query('ROLLBACK');
        request.log.error(e);
        return reply.code(500).send({ message: 'Conversion failed', error: String(e) } as any);
      } finally {
        client.release();
      }
  });

  // DELETE Lead
  app.withTypeProvider<ZodTypeProvider>().delete('/:leadId', {
      schema: {
          params: z.object({ leadId: z.string().uuid() }),
          response: {
              200: z.object({ ok: z.boolean(), message: z.string() }),
              404: z.object({ message: z.string() }),
              401: z.object({ message: z.string() })
          }
      }
  }, async (request, reply) => {
      const { user } = request;
      const { authService } = await import('../auth/auth.service');
      const context = await authService.getContext(user.userId);
      if (!context) return reply.code(401).send({ message: 'Unauthorized' });

      if (context.user.role !== 'boss' && context.user.role !== 'manager') {
           return reply.code(401).send({ message: 'Insufficient permissions' });
      }

      const deleted = await leadsRepository.delete(request.params.leadId, context.company.id);
      if (!deleted) return reply.code(404).send({ message: 'Lead not found' });
      
      return { ok: true, message: 'Lead deleted' };
  });
}
