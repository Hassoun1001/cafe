import { z } from 'zod';

export const openOrderSchema = z.object({
  tableId: z.string().uuid(),
});

export const addItemSchema = z.object({
  menuItemId: z.string().uuid(),
});

export const setLineQtySchema = z.object({
  qty: z.number().int(),
});

export const patchOrderSchema = z.object({
  discountPercent: z.number().min(0).max(100).optional(),
});

export const orderTaxSchema = z.object({
  taxRateId: z.string().uuid(),
});

export const paySchema = z.object({
  method: z.enum(['CASH', 'CARD']),
  cashReceived: z.number().min(0).optional(),
});

export const salesHistoryQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  table: z.coerce.number().int().optional(),
  payment: z.enum(['CASH', 'CARD']).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  // Capped at 5000 rather than a tight page size so the frontend can request
  // the FULL matching result set in one call for Excel/PDF export, while the
  // on-screen table itself still requests small pages (25) for browsing.
  pageSize: z.coerce.number().int().min(1).max(5000).optional().default(50),
});
