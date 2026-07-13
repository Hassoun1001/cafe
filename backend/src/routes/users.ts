import { Router, RequestHandler } from 'express';
import type { AppSystem } from '@prisma/client';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireAdmin } from '../middleware/auth';
import { createUserSchema, updateUserSchema, resetPasswordSchema } from '../schemas/users.schema';
import * as usersService from '../services/users.service';

// Account management, scoped to one system — used both by Cafe Settings and
// Study Settings to manage that app's own username+password logins. Entirely
// admin-only: managing other people's accounts (and their role) lives inside
// Settings, which STAFF can't reach at all.
export function createUsersRouter(system: AppSystem, authenticate: RequestHandler) {
  const router = Router();
  router.use(authenticate, requireAdmin);

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      res.json(await usersService.listUsers(system));
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const { username, password, role } = createUserSchema.parse(req.body);
      res.status(201).json(await usersService.createUser(system, username, password, role));
    }),
  );

  router.put(
    '/:id',
    asyncHandler(async (req, res) => {
      const data = updateUserSchema.parse(req.body);
      res.json(await usersService.updateUser(system, req.params.id, data));
    }),
  );

  router.post(
    '/:id/reset-password',
    asyncHandler(async (req, res) => {
      const { newPassword } = resetPasswordSchema.parse(req.body);
      await usersService.resetUserPassword(system, req.params.id, newPassword);
      res.json({ ok: true });
    }),
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      await usersService.deleteUser(system, req.params.id);
      res.status(204).end();
    }),
  );

  return router;
}
