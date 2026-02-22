import { z } from 'zod';

export const coverageReportQuerySchema = z.object({
  dateFrom: z.string().optional(), // YYYY-MM-DD
  dateTo: z.string().optional(),   // YYYY-MM-DD
  region: z.string().uuid().optional(),
});

export const coverageItemSchema = z.object({
  rep_id: z.string().uuid(),
  rep_name: z.string(),
  total_assigned: z.number(),
  shops_visited: z.number(),
  visit_count: z.number(),
  orders_count: z.number(),
  total_sales: z.number(),
  coverage_percentage: z.number(),
});

export const coverageReportResponseSchema = z.object({
  ok: z.boolean(),
  report: z.array(coverageItemSchema),
});

export const atRiskShopSchema = z.object({
  shop_id: z.string().uuid(),
  shop_name: z.string(),
  assigned_rep_name: z.string().nullable(),
  assigned_rep_id: z.string().nullable(),
  days_since_last_visit: z.number().nullable(),
  days_since_last_order: z.number().nullable(),
  total_order_value_30d: z.number(),
  last_visit_at: z.coerce.date().nullable(),
  last_order_at: z.coerce.date().nullable(),
});

export const atRiskShopsResponseSchema = z.object({
  ok: z.boolean(),
  shops: z.array(atRiskShopSchema),
});

export const leaderboardItemSchema = z.object({
  rep_id: z.string().uuid(),
  rep_name: z.string(),
  visits_today: z.number(),
  orders_today: z.number(),
  revenue_today: z.number(),
  visits_week: z.number(),
  orders_week: z.number(),
  revenue_week: z.number(),
  visits_mtd: z.number(),
  orders_mtd: z.number(),
  revenue_mtd: z.number(),
  exceptions_mtd: z.number(),
  verified_mtd: z.number(),
  exception_rate_mtd: z.number(),
  verified_rate_mtd: z.number(),
});

export const leaderboardResponseSchema = z.object({
  ok: z.boolean(),
  reps: z.array(leaderboardItemSchema),
});

export const unvisitedShopsQuerySchema = z.object({
  days: z.string().optional(),   // number of days, default 7
  rep: z.string().uuid().optional(),
  region: z.string().uuid().optional(),
});

export const unvisitedShopItemSchema = z.object({
  shop_id: z.string().uuid(),
  shop_name: z.string(),
  shop_address: z.string().nullable(),
  assigned_rep_name: z.string().nullable(),
  assigned_rep_id: z.string().nullable(),
  last_visit_at: z.coerce.date().nullable(),
  days_since_last_visit: z.number().nullable(),
  revenue_30d: z.number(),
});

export const unvisitedShopsResponseSchema = z.object({
  ok: z.boolean(),
  shops: z.array(unvisitedShopItemSchema),
  days: z.number(),
  total: z.number(),
});

export const flaggedRepItemSchema = z.object({
  rep_id: z.string().uuid(),
  rep_name: z.string(),
  flag_type: z.enum(['high_exception_rate', 'frequent_far_starts', 'repeated_coordinates']),
  total_visits: z.number(),
  exception_count: z.number(),
  exception_rate: z.number(),
  detail: z.string().nullable(),
});

export const flaggedRepsResponseSchema = z.object({
  ok: z.boolean(),
  flagged: z.array(flaggedRepItemSchema),
});

export const staffReportItemSchema = z.object({
  rep_id: z.string().uuid(),
  rep_name: z.string(),
  orders_count: z.number(),
  total_sales: z.number(),
  attendance_count: z.number(),
  leads_count: z.number(),
  visit_count: z.number(),
  compliance_count: z.number(),
  compliance_approved_count: z.number(),
  expenses_sum: z.number(),
  walking_ms: z.coerce.number(),
  driving_ms: z.coerce.number(),
  distance_km: z.coerce.number(),
});

export const staffReportResponseSchema = z.object({
  ok: z.boolean(),
  report: z.array(staffReportItemSchema),
});

export const staffReportQuerySchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export const staffPerformanceDetailQuerySchema = z.object({
  repId: z.string().uuid(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export const staffPerformanceDetailResponseSchema = z.object({
  ok: z.boolean(),
  attendance: z.array(z.any()),
  visits: z.array(z.any()),
  orders: z.array(z.any()),
  leads: z.array(z.any()),
  expenses: z.array(z.any()),
});
