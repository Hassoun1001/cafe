import { z } from 'zod';

export const saveCountsSchema = z.object({
  counts: z.array(z.object({ stockItemId: z.string().uuid(), physicalQty: z.number().min(0) })).min(1),
});
