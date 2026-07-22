import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticateStudy, requirePermission } from '../middleware/auth';
import { updateStudyConfigSchema } from '../schemas/study.schema';
import * as studyConfigService from '../services/studyConfig.service';

export const studyConfigRouter = Router();
studyConfigRouter.use(authenticateStudy);

// GET stays open — the Board reads hourly rates/currency for its live price
// display. Changing rates is only ever done from Study Settings, admin-only.
studyConfigRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await studyConfigService.getStudyConfig());
  }),
);

studyConfigRouter.patch(
  '/',
  requirePermission('study_config_manage'),
  asyncHandler(async (req, res) => {
    const data = updateStudyConfigSchema.parse(req.body);
    res.json(await studyConfigService.updateStudyConfig(data));
  }),
);
