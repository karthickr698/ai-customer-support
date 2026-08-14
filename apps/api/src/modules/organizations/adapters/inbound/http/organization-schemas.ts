import { z } from 'zod';

export const createOrganizationBodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Organization name is required')
    .max(80, 'Organization name must be at most 80 characters'),
});

export const updateOrganizationBodySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Organization name is required')
      .max(80, 'Organization name must be at most 80 characters')
      .optional(),
    slug: z
      .string()
      .trim()
      .min(3, 'Slug must be at least 3 characters')
      .max(48, 'Slug must be at most 48 characters')
      .optional(),
  })
  .refine((value) => value.name !== undefined || value.slug !== undefined, {
    message: 'Provide a name or slug to update',
  });

export const inviteMemberBodySchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address').max(254),
  role: z.enum(['admin', 'agent', 'viewer']),
});

export const changeMemberRoleBodySchema = z.object({
  role: z.enum(['owner', 'admin', 'agent', 'viewer']),
});

export const acceptInvitationBodySchema = z.object({
  token: z.string().min(1, 'Invitation token is required'),
});

export const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
