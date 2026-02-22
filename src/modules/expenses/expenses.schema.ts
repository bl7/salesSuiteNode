import { z } from 'zod';

export const expenseCategorySchema = z.enum(['Fuel', 'Food', 'Parking', 'Accommodation', 'Maintenance', 'Other']);

export const createExpenseSchema = z.object({
  amount: z.number().positive(),
  category: expenseCategorySchema,
  description: z.string().optional(),
  date: z.string().datetime().optional(), // defaults to now in repo
});

export const createExpensesBulkSchema = z.object({
  expenses: z.array(createExpenseSchema),
});

export const listExpensesQuerySchema = z.object({
  rep: z.string().uuid().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  category: expenseCategorySchema.optional(),
});

