import Fastify, { FastifyInstance, FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { ZodTypeProvider, serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import fjwt from '@fastify/jwt';
import fenv from '@fastify/env';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import { env } from './config/env';
import { authRoutes } from './modules/auth/auth.route';
import { healthRoutes } from './modules/health/health.route';
import { attendanceRoutes } from './modules/attendance/attendance.route';
import { leadsRoutes } from './modules/leads/leads.route';
import { shopsRoutes } from './modules/shops/shops.route';
import { shopsBulkRoutes } from './modules/shops/shops.bulk.route';
import { shopAssignmentsRoutes } from './modules/shops/shop-assignments.route';
import { productsRoutes } from './modules/products/products.route';
import { productsBulkRoutes } from './modules/products/products.bulk.route';
import { ordersRoutes } from './modules/orders/orders.route';
import { visitsRoutes } from './modules/visits/visits.route';
import { tasksRoutes } from './modules/tasks/tasks.route';
import { staffRoutes } from './modules/staff/staff.route';
import { profileRoutes } from './modules/profile/profile.route';
import { contactRoutes } from './modules/contact/contact.route';
import { reportsRoutes } from './modules/reports/reports.route';
import { regionsRoutes } from './modules/regions/regions.route';
import { expensesRoutes } from './modules/expenses/expenses.route';
import { activityRoutes } from './modules/activity/activity.route';
import { disclosuresRoutes } from './modules/disclosures/disclosures.route';

export async function buildApp(): Promise<FastifyInstance> {

  const app = Fastify({
    logger: {
      transport: env.NODE_ENV === 'development' ? {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      } : undefined,
    },
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Register plugins
  await app.register(cors, { 
    origin: true, // In production, restrict this!
    credentials: true, // Important for cookies
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  await app.register(cookie);
  await app.register(multipart);

  await app.register(fjwt, {
    secret: env.JWT_SECRET,
    cookie: {
      cookieName: 'kora_session',
      signed: false,
    },
  });

  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });

  // Register Application Routes
  
  // Health
  await app.register(healthRoutes, { prefix: '/api/health' });
  
  // Auth
  await app.register(authRoutes, { prefix: '/api/auth' });

  // Manager Routes
  await app.register(attendanceRoutes, { prefix: '/api/manager/attendance' });
  await app.register(leadsRoutes, { prefix: '/api/manager/leads' });
  await app.register(shopsRoutes, { prefix: '/api/manager/shops' });
  await app.register(shopsBulkRoutes, { prefix: '/api/manager/shops' });
  await app.register(shopAssignmentsRoutes, { prefix: '/api/manager/shop-assignments' });
  await app.register(productsRoutes, { prefix: '/api/manager/products' });
  await app.register(productsBulkRoutes, { prefix: '/api/manager/products' });
  await app.register(ordersRoutes, { prefix: '/api/manager/orders' });
  await app.register(visitsRoutes, { prefix: '/api/manager/visits' });
  await app.register(tasksRoutes, { prefix: '/api/manager/tasks' });
  await app.register(staffRoutes, { prefix: '/api/manager/staff' });
  await app.register(reportsRoutes, { prefix: '/api/manager/reports' });
  await app.register(regionsRoutes, { prefix: '/api/manager/regions' });
  await app.register(expensesRoutes, { prefix: '/api/manager/expenses' });
  await app.register(activityRoutes, { prefix: '/api/manager/activity' });
  await app.register(disclosuresRoutes, { prefix: '/api/manager/disclosures' });


  // Profile
  await app.register(profileRoutes, { prefix: '/api/profile' });

  // Contact
  await app.register(contactRoutes, { prefix: '/api/contact' });

  // Example error handler
  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error.validation) {
      reply.status(400).send({
        message: 'Validation Error',
        errors: error.validation,
      });
      return;
    }
    request.log.error(error);
    reply.status(500).send({ message: error.message || 'Internal Server Error' });
  });

  return app;
}
