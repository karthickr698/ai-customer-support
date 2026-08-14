import { z } from 'zod';

export const updateWidgetConfigurationBodySchema = z.object({
  enabled: z.boolean().optional(),
  title: z.string().trim().min(1).max(80).optional(),
  greeting: z.string().trim().min(1).max(280).optional(),
  primaryColor: z
    .string()
    .trim()
    .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Primary color must be a hex value such as #2563eb')
    .optional(),
  position: z.enum(['left', 'right']).optional(),
  launcherText: z.string().trim().min(1).max(40).optional(),
  collectEmail: z.boolean().optional(),
  allowAnonymous: z.boolean().optional(),
  allowAttachments: z.boolean().optional(),
  aiEnabled: z.boolean().optional(),
  offlineMessage: z.string().trim().min(1).max(280).optional(),
  allowedOrigins: z.array(z.string().trim().url().max(500)).max(50).optional(),
});

export const createWidgetSessionBodySchema = z.object({
  visitorId: z.string().trim().min(8).max(80).optional(),
  email: z.string().trim().email().max(254).optional(),
  name: z.string().trim().min(1).max(80).optional(),
});

export const identifyWidgetSessionBodySchema = z.object({
  email: z.string().trim().email('Enter a valid customer email address').max(254),
  name: z.string().trim().min(1, 'Customer name is required').max(80),
});
