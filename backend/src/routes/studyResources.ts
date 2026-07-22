import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticateStudy, requirePermission } from '../middleware/auth';
import { createStudyResourceSchema, updateStudyResourceSchema } from '../schemas/study.schema';
import * as tablesService from '../services/tables.service';

export const studyResourcesRouter = Router();
studyResourcesRouter.use(authenticateStudy);

// GET stays open — the Board needs the resource list to book from. Adding/
// renaming/removing a resource is only ever done from Study Settings,
// admin-only.
studyResourcesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await tablesService.listTables(['STUDY_TABLE', 'STUDY_ROOM']));
  }),
);

studyResourcesRouter.post(
  '/',
  requirePermission('study_resources_manage'),
  asyncHandler(async (req, res) => {
    const data = createStudyResourceSchema.parse(req.body);
    res.status(201).json(await tablesService.createTable(data));
  }),
);

studyResourcesRouter.put(
  '/:id',
  requirePermission('study_resources_manage'),
  asyncHandler(async (req, res) => {
    const data = updateStudyResourceSchema.parse(req.body);
    res.json(await tablesService.updateTable(req.params.id, data));
  }),
);

studyResourcesRouter.delete(
  '/:id',
  requirePermission('study_resources_manage'),
  asyncHandler(async (req, res) => {
    await tablesService.deleteTable(req.params.id);
    res.status(204).end();
  }),
);
