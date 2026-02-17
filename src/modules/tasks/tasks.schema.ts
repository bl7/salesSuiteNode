import { z } from 'zod';

export const taskSchema = z.object({
  id: z.string().uuid(),
  rep_company_user_id: z.string().uuid(),
  rep_name: z.string().optional(),
  title: z.string(),
  description: z.string().nullable(),
  status: z.enum(['pending', 'completed', 'cancelled', 'in_progress']),
  due_at: z.date().nullable().or(z.string().nullable()),
  completed_at: z.date().nullable().or(z.string().nullable()),
  lead_id: z.string().uuid().nullable().optional(),
  shop_id: z.string().uuid().nullable().optional(),
  created_at: z.date().or(z.string()),
  updated_at: z.date().or(z.string()),
});

export const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  repCompanyUserId: z.string().uuid(),
  dueAt: z.string().datetime().optional(),
  leadId: z.string().uuid().optional(),
  shopId: z.string().uuid().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(['pending', 'completed', 'cancelled', 'in_progress']).optional(),
  dueAt: z.string().datetime().nullable().optional(),
  leadId: z.string().uuid().optional(),
  shopId: z.string().uuid().optional(),
});

export const listTasksQuerySchema = z.object({
  status: z.string().optional(),
  rep: z.string().uuid().optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional()
});
