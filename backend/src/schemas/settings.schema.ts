import { z } from 'zod';

export const updateSettingsSchema = z.object({
  receiptName: z.string().min(1).optional(),
  receiptFooter: z.string().optional(),
  currency: z.string().min(1).optional(),
  usdExchangeRate: z.number().min(0).optional(),
});

export const discountPresetSchema = z.object({
  name: z.string().min(1),
  percent: z.number().min(0).max(100),
});

export const updateDiscountPresetSchema = z.object({
  name: z.string().min(1).optional(),
  percent: z.number().min(0).max(100).optional(),
  active: z.boolean().optional(),
});

export const taxRateSchema = z.object({
  name: z.string().min(1),
  percent: z.number().min(0).max(100),
  compound: z.boolean().optional().default(false),
  defaultOn: z.boolean().optional().default(false),
});

export const updateTaxRateSchema = z.object({
  name: z.string().min(1).optional(),
  percent: z.number().min(0).max(100).optional(),
  compound: z.boolean().optional(),
  defaultOn: z.boolean().optional(),
  active: z.boolean().optional(),
});

export const stockCategorySchema = z.object({
  name: z.string().min(1),
});

export const stockUnitSchema = z.object({
  name: z.string().min(1),
});
