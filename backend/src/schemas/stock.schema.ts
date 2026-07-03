import { z } from 'zod';

export const createStockSchema = z.object({
  name: z.string().min(1),
  nameAr: z.string().optional(),
  qty: z.number().min(0).default(0),
  unit: z.string().min(1),
  minQty: z.number().min(0).default(0),
  costPerUnit: z.number().min(0).default(0),
  category: z.string().min(1),
});

export const updateStockSchema = z.object({
  name: z.string().min(1).optional(),
  nameAr: z.string().optional(),
  category: z.string().min(1).optional(),
  unit: z.string().min(1).optional(),
  minQty: z.number().min(0).optional(),
  costPerUnit: z.number().min(0).optional(),
});

export const adjustStockSchema = z
  .object({
    delta: z.number().optional(),
    setTo: z.number().min(0).optional(),
    reason: z.enum(['RESTOCK', 'MANUAL_SET', 'MANUAL_DELTA', 'TRACKER_CORRECTION']),
    note: z.string().optional(),
  })
  .refine((d) => d.delta !== undefined || d.setTo !== undefined, {
    message: 'Provide either delta or setTo',
  });
