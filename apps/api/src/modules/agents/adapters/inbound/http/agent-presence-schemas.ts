import { z } from 'zod';

export const setAgentPresenceBodySchema = z.object({
  status: z.enum(['online', 'away', 'busy']),
});
