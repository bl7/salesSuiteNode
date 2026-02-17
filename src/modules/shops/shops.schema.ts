import { z } from 'zod';

export const shopSchema = z.object({
  id: z.string().uuid(),
  company_id: z.string().uuid(),
  external_shop_code: z.string().nullable(),
  name: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  geofence_radius_m: z.number(),
  is_active: z.boolean(),
  notes: z.string().nullable(),
  assignment_count: z.number().int().optional(), // Joined
  created_at: z.date(),
});

export const createShopSchema = z.object({
  name: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  geofenceRadius: z.number().positive(),
  externalShopCode: z.string().optional(),
  notes: z.string().optional(),
});

export const updateShopSchema = z.object({
  name: z.string().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().optional(),
});

export const listShopsQuerySchema = z.object({
  q: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});
