import { z } from 'zod';

export const acknowledgeDisclosureSchema = z.object({
  disclosure_acknowledged: z.boolean(),
  policy_version: z.string(),
  app_version: z.string().optional(),
  device_id: z.string().optional()
});

export const disclosureResponseSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  disclosure_acknowledged: z.boolean(),
  policy_version: z.string(),
  app_version: z.string().nullable(),
  device_id: z.string().nullable(),
  acknowledged_at: z.string().or(z.date()).nullable()
});
