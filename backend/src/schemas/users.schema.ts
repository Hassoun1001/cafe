import { z } from 'zod';

export const createUserSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const updateUserSchema = z.object({
  username: z.string().min(1).optional(),
  active: z.boolean().optional(),
});

export const resetPasswordSchema = z.object({
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
});
