import { z } from 'zod';

export const staffSchema = z.object({
  company_user_id: z.string().uuid(),
  user_id: z.string().uuid(),
  full_name: z.string(),
  email: z.string().email(),
  phone: z.string().nullable(),
  role: z.enum(['boss', 'manager', 'rep', 'back_office']),
  status: z.enum(['active', 'inactive', 'invited']),
  last_login_at: z.date().nullable().or(z.string().nullable()),
  created_at: z.date().or(z.string()),
  updated_at: z.date().or(z.string()).optional(),
});

export const inviteStaffSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  role: z.enum(['manager', 'rep']),
  phone: z.string().optional(),
});

export const updateStaffSchema = z.object({
  fullName: z.string().optional(),
  role: z.enum(['manager', 'rep']).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  phone: z.string().optional(),
});

export const listStaffQuerySchema = z.object({
  role: z.enum(['manager', 'rep']).optional(),
  status: z.enum(['active', 'inactive', 'invited']).optional(),
  q: z.string().optional(),
});
