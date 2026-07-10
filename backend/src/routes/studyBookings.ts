import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticateStudy } from '../middleware/auth';
import { createBookingSchema, updateBookingSchema, addDrinkSchema, completeBookingSchema } from '../schemas/study.schema';
import * as studyService from '../services/study.service';
import * as menuService from '../services/menu.service';

export const studyBookingsRouter = Router();
studyBookingsRouter.use(authenticateStudy);

const statusQuerySchema = z.object({ status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED']).optional() });

// Read-only view of the Cafe menu so the "add drink" picker has items to
// choose from — Study credentials can never reach the Cafe app's own
// /api/menu (different auth realm entirely), so this is its own route.
studyBookingsRouter.get(
  '/menu',
  asyncHandler(async (_req, res) => {
    res.json(await menuService.getMenu());
  }),
);

studyBookingsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { status } = statusQuerySchema.parse(req.query);
    res.json(await studyService.listBookings(status));
  }),
);

studyBookingsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { tableId, customerName } = createBookingSchema.parse(req.body);
    res.status(201).json(await studyService.createBooking(tableId, customerName));
  }),
);

studyBookingsRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = updateBookingSchema.parse(req.body);
    res.json(await studyService.updateBooking(req.params.id, data));
  }),
);

studyBookingsRouter.post(
  '/:id/drink',
  asyncHandler(async (req, res) => {
    const { menuItemId } = addDrinkSchema.parse(req.body);
    res.json(await studyService.addDrink(req.params.id, menuItemId));
  }),
);

studyBookingsRouter.post(
  '/:id/reset-timer',
  asyncHandler(async (req, res) => {
    res.json(await studyService.resetTimer(req.params.id));
  }),
);

studyBookingsRouter.post(
  '/:id/complete',
  asyncHandler(async (req, res) => {
    const { paymentMethod } = completeBookingSchema.parse(req.body);
    res.json(await studyService.completeBooking(req.params.id, paymentMethod));
  }),
);

studyBookingsRouter.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    res.json(await studyService.cancelBooking(req.params.id));
  }),
);

studyBookingsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await studyService.deleteBooking(req.params.id);
    res.status(204).end();
  }),
);
