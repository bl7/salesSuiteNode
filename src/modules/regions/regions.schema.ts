import { z } from 'zod';

// ── Row shape returned from DB ───────────────────────────────────────────────
export const regionSchema = z.object({
  id: z.string().uuid(),
  company_id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  color: z.string(),
  shop_count: z.number().int().optional(), // joined
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

// ── Create ───────────────────────────────────────────────────────────────────
export const createRegionSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex colour (#rrggbb)').optional(),
});

// ── Update ───────────────────────────────────────────────────────────────────
export const updateRegionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});
