import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { disclosuresRepository } from './disclosures.repository';
import { acknowledgeDisclosureSchema, disclosureResponseSchema } from './disclosures.schema';

export async function disclosuresRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });

  app.withTypeProvider<ZodTypeProvider>().get('/status', {
    schema: {
      querystring: z.object({
        policy_version: z.string()
      }),
      response: {
        200: z.object({ ok: z.boolean(), disclosure: disclosureResponseSchema.nullable() }),
        401: z.object({ message: z.string() })
      }
    }
  }, async (request, reply) => {
    const { user } = request;
    const policyVersion = request.query.policy_version;
    const disclosure = await disclosuresRepository.getDisclosure(user.userId, policyVersion);
    return { ok: true, disclosure };
  });

  app.withTypeProvider<ZodTypeProvider>().post('/acknowledge', {
    schema: {
      body: acknowledgeDisclosureSchema,
      response: {
        200: z.object({ ok: z.boolean(), disclosure: disclosureResponseSchema }),
        400: z.object({ message: z.string() }),
        401: z.object({ message: z.string() })
      }
    }
  }, async (request, reply) => {
    const { user } = request;
    const { policy_version, app_version, device_id } = request.body;

    const disclosure = await disclosuresRepository.acknowledgeDisclosure(
      user.userId,
      policy_version,
      app_version,
      device_id
    );

    return { ok: true, disclosure };
  });
}
