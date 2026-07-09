import { z } from 'zod';

export const createStudyResourceSchema = z.object({
  number: z.number().int().positive(),
  label: z.string().optional(),
  kind: z.enum(['STUDY_TABLE', 'STUDY_ROOM']),
});

export const updateStudyResourceSchema = z.object({
  label: z.string().optional(),
  active: z.boolean().optional(),
});

export const createBookingSchema = z.object({
  tableId: z.string().uuid(),
  customerName: z.string().optional(),
});

export const updateBookingSchema = z.object({
  customerName: z.string().optional(),
});

export const addDrinkSchema = z.object({
  menuItemId: z.string().uuid(),
});

export const completeBookingSchema = z.object({
  paymentMethod: z.enum(['CASH', 'CARD']),
});

export const updateStudyConfigSchema = z.object({
  tableHourlyRate: z.number().min(0).optional(),
  roomHourlyRate: z.number().min(0).optional(),
  currency: z.string().min(1).optional(),
});
