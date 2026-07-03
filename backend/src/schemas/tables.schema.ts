import { z } from 'zod';

export const createTableSchema = z.object({
  number: z.number().int().positive(),
  label: z.string().optional(),
});

export const updateTableSchema = z.object({
  label: z.string().optional(),
  active: z.boolean().optional(),
});
