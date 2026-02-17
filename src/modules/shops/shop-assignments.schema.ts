import { z } from 'zod';

export const shopAssignmentSchema = z.object({
  id: z.string().uuid(),
  shop_id: z.string().uuid(),
  rep_company_user_id: z.string().uuid(),
  is_primary: z.boolean(),
  assigned_at: z.date(),
});

export const createAssignmentSchema = z.object({
  shopId: z.string().uuid(),
  repCompanyUserId: z.string().uuid(),
  isPrimary: z.boolean().default(false),
});
