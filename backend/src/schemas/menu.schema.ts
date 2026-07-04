import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(1),
  sortOrder: z.number().int().optional(),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
});

export const createItemSchema = z.object({
  name: z.string().min(1),
  nameAr: z.string().optional(),
  sub: z.string().optional().default(''),
  price: z.number().min(0).optional().default(0),
  categoryId: z.string().uuid(),
  sortOrder: z.number().int().optional(),
});

export const updateItemSchema = z.object({
  name: z.string().min(1).optional(),
  nameAr: z.string().optional(),
  sub: z.string().optional(),
  price: z.number().min(0).optional(),
  categoryId: z.string().uuid().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const bulkItemEditSchema = z.object({
  edits: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        price: z.number().min(0).optional(),
        nameAr: z.string().optional(),
      }),
    )
    .min(1),
});

export const recipeIngredientSchema = z.object({
  stockItemId: z.string().uuid(),
  qtyPerUnit: z.number().min(0),
});
