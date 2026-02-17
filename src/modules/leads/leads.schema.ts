import { z } from 'zod';

export const leadSchema = z.object({
  id: z.string().uuid(),
  company_id: z.string().uuid(),
  shop_id: z.string().uuid().nullable(),
  name: z.string(),
  contact_name: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().email().nullable(),
  address: z.string().nullable(),
  status: z.enum(['new', 'contacted', 'qualified', 'converted', 'lost']),
  assigned_rep_company_user_id: z.string().uuid().nullable(),
  created_by_company_user_id: z.string().uuid(),
  notes: z.string().nullable(),
  converted_at: z.date().nullable(),
  created_at: z.date(),
  updated_at: z.date(),
  // Joined fields
  shop_name: z.string().nullable().optional(),
  assigned_rep_name: z.string().nullable().optional(),
});

export const createLeadSchema = z.object({
  name: z.string().min(1),
  shopId: z.string().uuid().optional().nullable(),
  contactName: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  address: z.string().optional().nullable(),
  assignedRepCompanyUserId: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const updateLeadSchema = z.object({
  status: z.enum(['new', 'contacted', 'qualified', 'converted', 'lost']).optional(),
  name: z.string().optional(),
  contactName: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  address: z.string().optional().nullable(),
  assignedRepCompanyUserId: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const listLeadsQuerySchema = z.object({
  status: z.enum(['new', 'contacted', 'qualified', 'converted', 'lost']).optional(),
  q: z.string().optional(),
});

export const convertToShopResponseSchema = z.object({
  ok: z.boolean(),
  shop: z.object({
    id: z.string().uuid(),
    name: z.string(),
    latitude: z.number().nullable(),
    longitude: z.number().nullable(),
  })
});
