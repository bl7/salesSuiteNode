import { z } from 'zod';

export const visitSchema = z.object({
  id: z.string().uuid(),
  company_id: z.string().uuid(),
  shop_id: z.string().uuid(),
  shop_name: z.string().nullable().optional(), // Joined
  rep_company_user_id: z.string().uuid(),
  rep_name: z.string().nullable().optional(), // Joined
  visit_date: z.date(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  notes: z.string().nullable(),
  purpose: z.string().nullable(),
  outcome: z.string().nullable(),
  image_url: z.string().nullable(),
  created_at: z.date(),
});

export const createVisitSchema = z.object({
  shopId: z.string().uuid(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  notes: z.string().optional(),
  purpose: z.string().optional(),
  outcome: z.string().optional(),
  imageUrl: z.string().optional()
});

export const updateVisitSchema = z.object({
  status: z.enum(['ongoing', 'completed', 'cancelled']).optional(),
  notes: z.string().optional(),
  purpose: z.string().optional(),
  outcome: z.string().optional(),
  imageUrl: z.string().optional()
});

export const listVisitsQuerySchema = z.object({
  rep: z.string().uuid().optional(),
  shop: z.string().uuid().optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional()
});
