import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate } from '../middleware/auth';
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

settingsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await settingsService.getSettings());
  }),
);

settingsRouter.patch(
  '/',
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
  asyncHandler(async (req, res) => {
    const data = discountPresetSchema.parse(req.body);
    res.status(201).json(await settingsService.createDiscountPreset(data));
  }),
);

settingsRouter.put(
  '/discount-presets/:id',
  asyncHandler(async (req, res) => {
    const data = updateDiscountPresetSchema.parse(req.body);
    res.json(await settingsService.updateDiscountPreset(req.params.id, data));
  }),
);

settingsRouter.delete(
  '/discount-presets/:id',
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
  asyncHandler(async (req, res) => {
    const data = taxRateSchema.parse(req.body);
    res.status(201).json(await settingsService.createTaxRate(data));
  }),
);

settingsRouter.put(
  '/tax-rates/:id',
  asyncHandler(async (req, res) => {
    const data = updateTaxRateSchema.parse(req.body);
    res.json(await settingsService.updateTaxRate(req.params.id, data));
  }),
);

settingsRouter.delete(
  '/tax-rates/:id',
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
  asyncHandler(async (req, res) => {
    const { name } = stockCategorySchema.parse(req.body);
    res.status(201).json(await settingsService.createStockCategory(name));
  }),
);

settingsRouter.delete(
  '/stock-categories/:id',
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
  asyncHandler(async (req, res) => {
    const { name } = stockUnitSchema.parse(req.body);
    res.status(201).json(await settingsService.createStockUnit(name));
  }),
);

settingsRouter.delete(
  '/stock-units/:id',
  asyncHandler(async (req, res) => {
    await settingsService.deleteStockUnit(req.params.id);
    res.status(204).end();
  }),
);

settingsRouter.post(
  '/danger/clear-sales',
  asyncHandler(async (_req, res) => {
    await settingsService.clearSales();
    res.json({ ok: true });
  }),
);

settingsRouter.post(
  '/danger/clear-employee-log',
  asyncHandler(async (_req, res) => {
    await settingsService.clearEmployeeLog();
    res.json({ ok: true });
  }),
);

settingsRouter.post(
  '/danger/reset-all',
  asyncHandler(async (_req, res) => {
    await settingsService.resetAll();
    res.json({ ok: true });
  }),
);
