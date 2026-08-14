import { z } from 'zod';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../../../domain/password-policy.js';

const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .email('Enter a valid email address')
  .max(254);

const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters`)
  .regex(/[A-Za-z]/, 'Password must include at least one letter')
  .regex(/[0-9]/, 'Password must include at least one number');

export const registerBodySchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z
    .string()
    .trim()
    .min(1, 'Display name is required')
    .max(80, 'Display name must be at most 80 characters'),
});

export const loginBodySchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(PASSWORD_MAX_LENGTH),
});

export const emailOnlyBodySchema = z.object({
  email: emailSchema,
});

export const resetPasswordBodySchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: passwordSchema,
});

export const verifyEmailBodySchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

export const completeOAuthBodySchema = z.object({
  code: z.string().min(1, 'Login code is required'),
});
