import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticateStudy } from '../middleware/auth';
import { updateStudyConfigSchema } from '../schemas/study.schema';
import * as studyConfigService from '../services/studyConfig.service';

export const studyConfigRouter = Router();
studyConfigRouter.use(authenticateStudy);

studyConfigRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await studyConfigService.getStudyConfig());
  }),
);

studyConfigRouter.patch(
  '/',
  asyncHandler(async (req, res) => {
    const data = updateStudyConfigSchema.parse(req.body);
    res.json(await studyConfigService.updateStudyConfig(data));
  }),
);
