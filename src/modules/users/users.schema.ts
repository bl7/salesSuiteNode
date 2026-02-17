import { z } from 'zod';

export const userCore = {
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['ADMIN', 'SALES_REP', 'USER']).default('USER'),
};

export const createUserSchema = z.object({
  ...userCore,
});

export const userResponseSchema = z.object({
  id: z.string().uuid(),
  email: userCore.email,
  role: userCore.role,
  createdAt: z.string(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UserResponse = z.infer<typeof userResponseSchema>;
