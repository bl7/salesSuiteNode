import { z } from 'zod';

export const dailyActivitySyncSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  walking_duration_ms: z.number().int().min(0).optional(),
  driving_duration_ms: z.number().int().min(0).optional(),
  still_duration_ms: z.number().int().min(0).optional(),
  total_distance_km: z.number().min(0).optional(),
});

export const getActivityStatsQuerySchema = z.object({
  rep: z.string().uuid().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
});
