import { z } from 'zod';

export const productSchema = z.object({
  id: z.string().uuid(),
  company_id: z.string().uuid(),
  name: z.string(),
  sku: z.string(),
  description: z.string().nullable(),
  unit: z.string(),
  is_active: z.boolean(),
  current_price: z.union([z.number(), z.string()]).nullable().optional(), 
  currency_code: z.string().nullable().optional(),
  order_count: z.union([z.number(), z.string()]).optional(), // Joined
  created_at: z.date(),
});

export const createProductSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  description: z.string().optional().nullable(),
  unit: z.string().min(1),
  price: z.number().min(0.01),
  currencyCode: z.string().length(3).default('NPR'),
});

export const updateProductSchema = z.object({
  name: z.string().optional(),
  sku: z.string().optional(),
  description: z.string().optional().nullable(),
  unit: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const listProductsQuerySchema = z.object({
  q: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export const setPriceSchema = z.object({
  price: z.number().min(0),
  currencyCode: z.string().length(3).default('NPR'),
});
