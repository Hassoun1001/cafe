import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate, requireAdmin } from '../middleware/auth';
import {
  updateSettingsSchema,
  discountPresetSchema,
  updateDiscountPresetSchema,
  taxRateSchema,
  updateTaxRateSchema,
  stockCategorySchema,
  stockUnitSchema,
} from '../schemas/settings.schema';
import * as settingsService from '../services/settings.service';

export const settingsRouter = Router();
settingsRouter.use(authenticate);

// GET endpoints stay open to any authenticated user — the POS/Warehouse/
// Reports pages read currency, tax rates, discount presets, and stock
// categories/units for their own normal operation. Only mutations (and the
// Danger Zone) require admin; STAFF simply never sees the Settings page
// itself on the frontend, so in practice they only ever hit these reads.
settingsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await settingsService.getSettings());
  }),
);

settingsRouter.patch(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const data = updateSettingsSchema.parse(req.body);
    res.json(await settingsService.updateSettings(data));
  }),
);

settingsRouter.get(
  '/discount-presets',
  asyncHandler(async (_req, res) => {
    res.json(await settingsService.listDiscountPresets());
  }),
);

settingsRouter.post(
  '/discount-presets',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const data = discountPresetSchema.parse(req.body);
    res.status(201).json(await settingsService.createDiscountPreset(data));
  }),
);

settingsRouter.put(
  '/discount-presets/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const data = updateDiscountPresetSchema.parse(req.body);
    res.json(await settingsService.updateDiscountPreset(req.params.id, data));
  }),
);

settingsRouter.delete(
  '/discount-presets/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    await settingsService.deleteDiscountPreset(req.params.id);
    res.status(204).end();
  }),
);

settingsRouter.get(
  '/tax-rates',
  asyncHandler(async (_req, res) => {
    res.json(await settingsService.listTaxRates());
  }),
);

settingsRouter.post(
  '/tax-rates',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const data = taxRateSchema.parse(req.body);
    res.status(201).json(await settingsService.createTaxRate(data));
  }),
);

settingsRouter.put(
  '/tax-rates/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const data = updateTaxRateSchema.parse(req.body);
    res.json(await settingsService.updateTaxRate(req.params.id, data));
  }),
);

settingsRouter.delete(
  '/tax-rates/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    await settingsService.deleteTaxRate(req.params.id);
    res.status(204).end();
  }),
);

settingsRouter.get(
  '/stock-categories',
  asyncHandler(async (_req, res) => {
    res.json(await settingsService.listStockCategories());
  }),
);

settingsRouter.post(
  '/stock-categories',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { name } = stockCategorySchema.parse(req.body);
    res.status(201).json(await settingsService.createStockCategory(name));
  }),
);

settingsRouter.delete(
  '/stock-categories/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    await settingsService.deleteStockCategory(req.params.id);
    res.status(204).end();
  }),
);

settingsRouter.get(
  '/stock-units',
  asyncHandler(async (_req, res) => {
    res.json(await settingsService.listStockUnits());
  }),
);

settingsRouter.post(
  '/stock-units',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { name } = stockUnitSchema.parse(req.body);
    res.status(201).json(await settingsService.createStockUnit(name));
  }),
);

settingsRouter.delete(
  '/stock-units/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    await settingsService.deleteStockUnit(req.params.id);
    res.status(204).end();
  }),
);

settingsRouter.post(
  '/danger/clear-sales',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    await settingsService.clearSales();
    res.json({ ok: true });
  }),
);

settingsRouter.post(
  '/danger/clear-employee-log',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    await settingsService.clearEmployeeLog();
    res.json({ ok: true });
  }),
);

settingsRouter.post(
  '/danger/reset-all',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    await settingsService.resetAll();
    res.json({ ok: true });
  }),
);
