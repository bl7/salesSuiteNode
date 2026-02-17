import { z } from 'zod';

export const contactFormSchema = z.object({
  name: z.string().min(1),
  company: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  teamSize: z.string().optional(),
  message: z.string().min(1)
});

export const contactFormResponseSchema = z.object({
  ok: z.boolean(),
  message: z.string()
});
