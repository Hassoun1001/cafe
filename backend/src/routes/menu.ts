import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate, requirePermission } from '../middleware/auth';
import {
  createCategorySchema,
  updateCategorySchema,
  createItemSchema,
  updateItemSchema,
  bulkItemEditSchema,
  recipeIngredientSchema,
} from '../schemas/menu.schema';
import * as menuService from '../services/menu.service';

export const menuRouter = Router();
menuRouter.use(authenticate);

// GET / stays open — the POS page reads the menu for every order. Everything
// else here (categories, items, prices, recipes) is only ever reached via
// the Settings page, gated behind the menu_manage permission.
menuRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await menuService.getMenu());
  }),
);

menuRouter.post(
  '/categories',
  requirePermission('menu_manage'),
  asyncHandler(async (req, res) => {
    const data = createCategorySchema.parse(req.body);
    res.status(201).json(await menuService.createCategory(data));
  }),
);

menuRouter.put(
  '/categories/:id',
  requirePermission('menu_manage'),
  asyncHandler(async (req, res) => {
    const data = updateCategorySchema.parse(req.body);
    res.json(await menuService.updateCategory(req.params.id, data));
  }),
);

menuRouter.delete(
  '/categories/:id',
  requirePermission('menu_manage'),
  asyncHandler(async (req, res) => {
    await menuService.deleteCategory(req.params.id);
    res.status(204).end();
  }),
);

menuRouter.post(
  '/items',
  requirePermission('menu_manage'),
  asyncHandler(async (req, res) => {
    const data = createItemSchema.parse(req.body);
    res.status(201).json(await menuService.createItem(data));
  }),
);

menuRouter.patch(
  '/items/prices',
  requirePermission('menu_manage'),
  asyncHandler(async (req, res) => {
    const { edits } = bulkItemEditSchema.parse(req.body);
    await menuService.bulkSaveItems(edits);
    res.json({ ok: true });
  }),
);

menuRouter.put(
  '/items/:id',
  requirePermission('menu_manage'),
  asyncHandler(async (req, res) => {
    const data = updateItemSchema.parse(req.body);
    res.json(await menuService.updateItem(req.params.id, data));
  }),
);

menuRouter.delete(
  '/items/:id',
  requirePermission('menu_manage'),
  asyncHandler(async (req, res) => {
    await menuService.deleteItem(req.params.id);
    res.status(204).end();
  }),
);

menuRouter.get(
  '/items/:id/recipe',
  requirePermission('menu_manage'),
  asyncHandler(async (req, res) => {
    res.json(await menuService.getRecipe(req.params.id));
  }),
);

menuRouter.post(
  '/items/:id/recipe',
  requirePermission('menu_manage'),
  asyncHandler(async (req, res) => {
    const { stockItemId, qtyPerUnit } = recipeIngredientSchema.parse(req.body);
    res.json(await menuService.setRecipeIngredient(req.params.id, stockItemId, qtyPerUnit));
  }),
);

menuRouter.delete(
  '/items/:id/recipe/:stockItemId',
  requirePermission('menu_manage'),
  asyncHandler(async (req, res) => {
    res.json(await menuService.removeRecipeIngredient(req.params.id, req.params.stockItemId));
  }),
);
