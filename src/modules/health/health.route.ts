import { FastifyInstance } from 'fastify';
import { pool } from '../../db/pool';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/', async (request, reply) => { // Fixed: added request and reply args
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
      return { ok: true, database: 'connected', version: '1.0.0' };
    } catch (err: any) {
        app.log.error(err);
        return reply.code(503).send({ ok: false, database: 'disconnected' });
    } finally {
      client.release();
    }
  });

  app.get('/db', async (request, reply) => {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
      return { ok: true, database: 'connected', time: new Date().toISOString() };
    } catch (err) {
      app.log.error(err);
      return reply.code(503).send({ ok: false, database: 'disconnected' });
    } finally {
      client.release();
    }
  });
}
