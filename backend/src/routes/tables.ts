import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate, requireAdmin } from '../middleware/auth';
import { createTableSchema, updateTableSchema } from '../schemas/tables.schema';
import * as tablesService from '../services/tables.service';

export const tablesRouter = Router();
tablesRouter.use(authenticate);

tablesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    // Cafe staff can view Study tables/rooms (and their linked bills) from
    // this same authenticated Cafe endpoint without needing Study
    // credentials — ?kind=study switches to that view, default stays DINING.
    const kinds = req.query.kind === 'study' ? (['STUDY_TABLE', 'STUDY_ROOM'] as const) : undefined;
    res.json(await tablesService.listTables(kinds ? [...kinds] : undefined));
  }),
);

// Add/rename/delete a table — only ever reached via Settings, admin-only.
tablesRouter.post(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const data = createTableSchema.parse(req.body);
    res.status(201).json(await tablesService.createTable(data));
  }),
);

tablesRouter.put(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const data = updateTableSchema.parse(req.body);
    res.json(await tablesService.updateTable(req.params.id, data));
  }),
);

tablesRouter.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    await tablesService.deleteTable(req.params.id);
    res.status(204).end();
  }),
);
