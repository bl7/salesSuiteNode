import { z } from 'zod';

// Shared
const userResponseSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string(),
  email: z.string().email(),
  phone: z.string().nullable(),
  role: z.string(),
  companyUserId: z.string().uuid(),
  status: z.string().optional(),
  isPlatformAdmin: z.boolean().optional(),
});

const companyResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  address: z.string(),
  plan: z.string().optional(),
  subscriptionEndsAt: z.string().nullable().optional(),
  staffLimit: z.number().optional(),
  staffCount: z.number().optional(),
});

// Login
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const loginResponseSchema = z.object({
  ok: z.boolean(),
  user: userResponseSchema,
  company: companyResponseSchema,
  token: z.string(),
});

// Signup Company
export const signupCompanySchema = z.object({
  companyName: z.string().min(1),
  companySlug: z.string().min(1), // could add regex validation for slugs
  address: z.string(),
  fullName: z.string(),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().regex(/^\+977\d{10}$/, 'Phone must be in format +977XXXXXXXXXX'),
  role: z.enum(['boss', 'manager']),
});

export const signupCompanyResponseSchema = z.object({
  ok: z.boolean(),
  company: z.object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
  }),
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    fullName: z.string(),
    role: z.string(),
    companyUserId: z.string().uuid(),
  })
});

// Me
export const meResponseSchema = z.object({
  ok: z.boolean(),
  user: userResponseSchema,
  company: companyResponseSchema,
});

// Forgot Password
export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const forgotPasswordResponseSchema = z.object({
  ok: z.boolean(),
  message: z.string(),
});

// Reset Password
export const resetPasswordSchema = z.object({
  token: z.string().uuid(),
  password: z.string().min(8),
});

export const resetPasswordResponseSchema = z.object({
  ok: z.boolean(),
  message: z.string(),
});

// Verify Email
export const verifyEmailQuerySchema = z.object({
  token: z.string().uuid(),
});

// Logout
export const logoutResponseSchema = z.object({
  ok: z.boolean(),
  message: z.string(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupCompanyInput = z.infer<typeof signupCompanySchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
