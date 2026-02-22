import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { createExpensesBulkSchema, listExpensesQuerySchema } from './expenses.schema';
import { expenseRepository } from './expenses.repository';

export async function expensesRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  // Bulk create expenses (usually at EOD)
  typedApp.post('/bulk', {
    schema: {
      body: createExpensesBulkSchema,
    },
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const { expenses } = req.body;
    const { companyId, companyUserId } = req.user;

    const results = await expenseRepository.createBulk(companyId, companyUserId, expenses);
    return { ok: true, data: { expenses: results } };
  });

  // List expenses (Manager view)
  typedApp.get('/', {
    schema: {
      querystring: listExpensesQuerySchema,
    },
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const { companyId } = req.user;
    const { rep, date_from, date_to, category } = req.query;

    const expenses = await expenseRepository.findAll({
      companyId,
      repCompanyUserId: rep,
      dateFrom: date_from,
      dateTo: date_to,
      category,
    });

    return { ok: true, data: { expenses } };
  });
}
