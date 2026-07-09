import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate } from '../middleware/auth';
import { badRequest } from '../lib/errors';
import * as importService from '../services/import.service';

export const importRouter = Router();
importRouter.use(authenticate);

// Kept small and memory-only — this is an occasional admin action (a
// handful of daily ledger exports), not a general file-storage feature.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

importRouter.post(
  '/sales-ledger',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest('No file uploaded', 'NO_FILE');
    res.json(await importService.importLedgerFile(req.file.buffer));
  }),
);
