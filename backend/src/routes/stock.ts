import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate } from '../middleware/auth';
import { createStockSchema, adjustStockSchema, updateStockSchema } from '../schemas/stock.schema';
import * as stockService from '../services/stock.service';

export const stockRouter = Router();
stockRouter.use(authenticate);

stockRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await stockService.listStock());
  }),
);

stockRouter.get(
  '/low',
  asyncHandler(async (_req, res) => {
    res.json(await stockService.lowStock());
  }),
);

stockRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = createStockSchema.parse(req.body);
    res.status(201).json(await stockService.addOrRestock(data));
  }),
);

stockRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = updateStockSchema.parse(req.body);
    res.json(await stockService.updateStockItem(req.params.id, data));
  }),
);

stockRouter.patch(
  '/:id/adjust',
  asyncHandler(async (req, res) => {
    const data = adjustStockSchema.parse(req.body);
    res.json(await stockService.adjustStock(req.params.id, data));
  }),
);

stockRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await stockService.deleteStockItem(req.params.id);
    res.status(204).end();
  }),
);
