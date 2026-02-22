import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { createExpensesBulkSchema, listExpensesQuerySchema, createExpenseSchema } from './expenses.schema';
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
    const { authService } = await import('../auth/auth.service');
    const context = await authService.getContext(req.user.userId);
    if (!context) return reply.status(401).send({ message: 'Unauthorized' });

    const { expenses } = req.body;
    const { companyUserId } = context.user;
    const companyId = context.company.id;

    const results = await expenseRepository.createBulk(companyId, companyUserId, expenses);
    return { ok: true, expenses: results };
  });



  // List expenses (Manager view / Rep view)
  typedApp.get('/', {
    schema: {
      querystring: listExpensesQuerySchema,
    },
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const { authService } = await import('../auth/auth.service');
    const context = await authService.getContext(req.user.userId);
    if (!context) return reply.status(401).send({ message: 'Unauthorized' });

    const { id: companyId } = context.company;
    const { role, companyUserId } = context.user;

    const { rep, date_from, date_to, category } = req.query;

    // Security: If not a manager/boss, only allowed to see own expenses
    let targetRepId = rep;
    if (role !== 'manager' && role !== 'boss') {
      targetRepId = companyUserId;
    }

    const expenses = await expenseRepository.findAll({
      companyId,
      repCompanyUserId: targetRepId,
      dateFrom: date_from,
      dateTo: date_to,
      category,
    });

    return { ok: true, expenses };
  });



  // Delete expense
  typedApp.delete('/:id', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { authService } = await import('../auth/auth.service');
    const context = await authService.getContext(req.user.userId);
    if (!context) return reply.status(401).send({ message: 'Unauthorized' });

    const { id: companyId } = context.company;
    const { role, companyUserId } = context.user;

    const expense = await expenseRepository.findById(id);
    if (!expense) return reply.status(404).send({ message: 'Expense not found' });
    
    // Security check
    if (expense.company_id !== companyId) return reply.status(403).send({ message: 'Forbidden' });

    if (role !== 'manager' && role !== 'boss' && expense.rep_company_user_id !== companyUserId) {
      return reply.status(403).send({ message: 'Forbidden' });
    }

    await expenseRepository.delete(id);
    return { ok: true };
  });

  // Update expense
  typedApp.patch('/:id', {
    schema: {
      body: createExpenseSchema.partial(),
    },
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { authService } = await import('../auth/auth.service');
    const context = await authService.getContext(req.user.userId);
    if (!context) return reply.status(401).send({ message: 'Unauthorized' });

    const { id: companyId } = context.company;
    const { role, companyUserId } = context.user;

    const expense = await expenseRepository.findById(id);
    if (!expense) return reply.status(404).send({ message: 'Expense not found' });

    // Security check
    if (expense.company_id !== companyId) return reply.status(403).send({ message: 'Forbidden' });

    if (role !== 'manager' && role !== 'boss' && expense.rep_company_user_id !== companyUserId) {
      return reply.status(403).send({ message: 'Forbidden' });
    }

    const updated = await expenseRepository.update(id, req.body);
    return { ok: true, data: { expense: updated } };
  });
}

