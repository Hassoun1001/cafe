import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate } from '../middleware/auth';
import { saveCountsSchema } from '../schemas/tracker.schema';
import * as trackerService from '../services/tracker.service';
import { createReportDoc, drawTable } from '../lib/reportPdf';
import { formatDateTime, streamPdf } from '../lib/reportFormat';

export const trackerRouter = Router();
trackerRouter.use(authenticate);

trackerRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await trackerService.currentStockForTracker());
  }),
);

trackerRouter.get(
  '/history',
  asyncHandler(async (_req, res) => {
    res.json(await trackerService.trackerHistory());
  }),
);

trackerRouter.get(
  '/history.pdf',
  asyncHandler(async (_req, res) => {
    const history = await trackerService.trackerHistory();
    const doc = createReportDoc('Stock Tracker History', `Generated ${formatDateTime(new Date())}`);
    drawTable(
      doc,
      [
        { header: 'Date', width: 110 },
        { header: 'Item', width: 180 },
        { header: 'System', width: 80, align: 'right' },
        { header: 'Physical', width: 80, align: 'right' },
        { header: 'Diff', width: 60, align: 'right' },
      ],
      history.map((h) => [formatDateTime(h.date), h.item, h.system, h.physical, h.diff]),
    );
    streamPdf(res, doc, 'tracker-history.pdf');
  }),
);

trackerRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { counts } = saveCountsSchema.parse(req.body);
    const saved = await trackerService.saveCounts(counts);
    res.json({ saved });
  }),
);
