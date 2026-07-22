import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate, requirePermission } from '../middleware/auth';
import { badRequest } from '../lib/errors';
import * as importService from '../services/import.service';

export const importRouter = Router();
importRouter.use(authenticate, requirePermission('import_legacy'));

// Memory-only (not saved to disk) — this is an occasional admin action, not
// a general file-storage feature. 25MB comfortably covers even a multi-year
// ledger export; the previous 5MB cap was too tight for real exports and
// forced splitting a file into several smaller ones to get under it.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

importRouter.post(
  '/sales-ledger',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest('No file uploaded', 'NO_FILE');
    res.json(await importService.importLedgerFile(req.file.buffer));
  }),
);
