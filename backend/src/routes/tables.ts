import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate } from '../middleware/auth';
import { createTableSchema, updateTableSchema } from '../schemas/tables.schema';
import * as tablesService from '../services/tables.service';

export const tablesRouter = Router();
tablesRouter.use(authenticate);

tablesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await tablesService.listTables());
  }),
);

tablesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = createTableSchema.parse(req.body);
    res.status(201).json(await tablesService.createTable(data));
  }),
);

tablesRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = updateTableSchema.parse(req.body);
    res.json(await tablesService.updateTable(req.params.id, data));
  }),
);

tablesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await tablesService.deleteTable(req.params.id);
    res.status(204).end();
  }),
);
