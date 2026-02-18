import { z } from 'zod';

export const shopSchema = z.object({
  id: z.string().uuid(),
  company_id: z.string().uuid(),
  external_shop_code: z.string().nullable(),
  name: z.string(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  geofence_radius_m: z.number(),
  is_active: z.boolean(),
  notes: z.string().nullable(),
  address: z.string().nullable(),
  contact_name: z.string().nullable(),
  contact_email: z.string().nullable(),
  contact_phone: z.string().nullable(),
  operating_hours: z.string().nullable(),
  preferred_visit_days: z.string().nullable(),
  payment_status: z.string().nullable(),
  assignment_count: z.number().int().optional(), // Joined
  created_at: z.coerce.date(),
});

export const createShopSchema = z.object({
  name: z.string().min(1),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  geofenceRadiusM: z.number().positive().default(100),
  externalShopCode: z.string().optional(),
  notes: z.string().optional(),
  address: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().optional(),
  contactPhone: z.string().optional(),
  operatingHours: z.string().optional(),
  preferredVisitDays: z.string().optional(),
  paymentStatus: z.string().optional(),
});

export const updateShopSchema = z.object({
  name: z.string().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().optional(),
  geofenceRadiusM: z.number().positive().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  address: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().optional(),
  contactPhone: z.string().optional(),
  operatingHours: z.string().optional(),
  preferredVisitDays: z.string().optional(),
  paymentStatus: z.string().optional(),
});

export const listShopsQuerySchema = z.object({
  q: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});
