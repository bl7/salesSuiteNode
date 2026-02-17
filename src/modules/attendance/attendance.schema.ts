import { z } from 'zod';

export const clockInSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  notes: z.string().optional(),
});

export const clockOutSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  notes: z.string().optional(),
});

export const getAttendanceQuerySchema = z.object({
  rep: z.string().uuid().optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
});

export const attendanceLogResponseSchema = z.object({
  id: z.string().uuid(),
  rep_company_user_id: z.string().uuid(),
  clock_in_at: z.date(),
  clock_out_at: z.date().nullable(),
  clock_in_latitude: z.number(),
  clock_in_longitude: z.number(),
  clock_out_latitude: z.number().nullable(),
  clock_out_longitude: z.number().nullable(),
  notes: z.string().nullable(),
  rep_name: z.string().optional(),
});

export const attendanceListResponseSchema = z.object({
  ok: z.boolean(),
  logs: z.array(attendanceLogResponseSchema),
});
