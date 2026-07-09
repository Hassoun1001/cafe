import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticateStudy } from '../middleware/auth';
import { createStudyResourceSchema, updateStudyResourceSchema } from '../schemas/study.schema';
import * as tablesService from '../services/tables.service';

export const studyResourcesRouter = Router();
studyResourcesRouter.use(authenticateStudy);

studyResourcesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await tablesService.listTables(['STUDY_TABLE', 'STUDY_ROOM']));
  }),
);

studyResourcesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = createStudyResourceSchema.parse(req.body);
    res.status(201).json(await tablesService.createTable(data));
  }),
);

studyResourcesRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = updateStudyResourceSchema.parse(req.body);
    res.json(await tablesService.updateTable(req.params.id, data));
  }),
);

studyResourcesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await tablesService.deleteTable(req.params.id);
    res.status(204).end();
  }),
);
