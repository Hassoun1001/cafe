import { z } from 'zod';

export const createEmployeeSchema = z.object({
  name: z.string().min(1),
  nameAr: z.string().optional(),
});

export const updateEmployeeSchema = z.object({
  name: z.string().min(1).optional(),
  nameAr: z.string().optional(),
  active: z.boolean().optional(),
});

export const logConsumptionSchema = z.object({
  employeeId: z.string().uuid(),
  itemName: z.string().min(1),
  price: z.number().min(0),
  type: z.enum(['FREE', 'DEDUCT']),
});
