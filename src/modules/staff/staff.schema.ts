import { z } from 'zod';

export const staffSchema = z.object({
  company_user_id: z.string().uuid(),
  user_id: z.string().uuid(),
  full_name: z.string(),
  email: z.string().email(),
  phone: z.string().nullable(),
  role: z.enum(['boss', 'manager', 'rep', 'back_office', 'dispatch_supervisor']),
  status: z.enum(['active', 'inactive', 'invited']),
  last_login_at: z.date().nullable().or(z.string().nullable()),
  created_at: z.date().or(z.string()),
  updated_at: z.date().or(z.string()).optional(),
});

export const inviteStaffSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  role: z.enum(['manager', 'rep', 'dispatch_supervisor']),
  phone: z.string().regex(/^\+977\d{10}$/, 'Phone must be in format +977XXXXXXXXXX').optional().or(z.literal('')),
});

export const updateStaffSchema = z.object({
  fullName: z.string().optional(),
  role: z.enum(['manager', 'rep', 'dispatch_supervisor']).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  phone: z.string().regex(/^\+977\d{10}$/, 'Phone must be in format +977XXXXXXXXXX').optional().or(z.literal('')),
});

export const listStaffQuerySchema = z.object({
  role: z.enum(['manager', 'rep', 'dispatch_supervisor']).optional(),
  status: z.enum(['active', 'inactive', 'invited']).optional(),
  q: z.string().optional(),
});
