import { z } from 'zod';

export const EXCEPTION_REASONS = [
  'gps_drift',
  'shop_moved',
  'road_blocked',
  'alternate_location',
  'customer_requested_outside',
  'low_gps_accuracy',
  'other',
] as const;

export const visitSchema = z.object({
  id: z.string().uuid(),
  company_id: z.string().uuid(),
  shop_id: z.string().uuid(),
  shop_name: z.string().nullable().optional(), // Joined
  rep_company_user_id: z.string().uuid(),
  rep_name: z.string().nullable().optional(), // Joined
  region_id: z.string().uuid().nullable().optional(), // Joined
  region_name: z.string().nullable().optional(), // Joined
  visit_date: z.coerce.date(),
  started_at: z.coerce.date(),
  ended_at: z.coerce.date().nullable().optional(),
  status: z.string().optional(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  notes: z.string().nullable(),
  purpose: z.string().nullable(),
  outcome: z.string().nullable(),
  image_url: z.string().nullable(),
  is_verified: z.boolean().optional(),
  distance_m: z.number().nullable().optional(),
  verification_method: z.string().nullable().optional(),
  exception_reason: z.string().nullable().optional(),
  exception_note: z.string().nullable().optional(),
  gps_accuracy_m: z.number().nullable().optional(),
  verified_at: z.coerce.date().nullable().optional(),
  end_lat: z.number().nullable().optional(),
  end_lng: z.number().nullable().optional(),
  approved_by_manager_id: z.string().nullable().optional(),
  approved_at: z.coerce.date().nullable().optional(),
  flagged_by_manager_id: z.string().nullable().optional(),
  manager_note: z.string().nullable().optional(),
  created_at: z.coerce.date(),
});

export const createVisitSchema = z.object({
  shopId: z.string().uuid(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  gpsAccuracyM: z.number().optional().nullable(),
  notes: z.string().optional(),
  purpose: z.string().optional(),
  outcome: z.string().optional(),
  imageUrl: z.string().optional(),
  // Exception fields — sent by mobile when rep is out of range
  exceptionReason: z.enum(EXCEPTION_REASONS).optional(),
  exceptionNote: z.string().optional(),
});

export const updateVisitSchema = z.object({
  status: z.enum(['ongoing', 'completed', 'cancelled']).optional(),
  end: z.boolean().optional(),
  notes: z.string().optional(),
  purpose: z.string().optional(),
  outcome: z.string().optional(),
  imageUrl: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  endLatitude: z.number().optional().nullable(),
  endLongitude: z.number().optional().nullable(),
  // Manager actions
  approve: z.boolean().optional(),
  flag: z.boolean().optional(),
  managerNote: z.string().optional(),
});

export const listVisitsQuerySchema = z.object({
  rep: z.string().uuid().optional(),
  shop: z.string().uuid().optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
  exceptions_only: z.string().optional(), // 'true' to filter only exception visits
  region: z.string().uuid().optional(),
});
