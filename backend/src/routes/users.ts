import { Router, RequestHandler } from 'express';
import type { AppSystem } from '@prisma/client';
import { asyncHandler } from '../middleware/asyncHandler';
import { requirePermission } from '../middleware/auth';
import { createUserSchema, updateUserSchema, resetPasswordSchema } from '../schemas/users.schema';
import * as usersService from '../services/users.service';
import { permissionsForSystem } from '../lib/permissions';

// Account management, scoped to one system — used both by Cafe Settings and
// Study Settings to manage that app's own username+password logins. Gated
// behind the system-specific "manage users" permission (users_manage /
// study_users_manage) rather than requireAdmin, so an ADMIN can delegate
// account management to a trusted STAFF member without making them a full
// admin — that STAFF member can then grant/revoke any permission (including
// their own), which is an accepted tradeoff of a per-action permission model.
export function createUsersRouter(system: AppSystem, authenticate: RequestHandler, permissionKey: string) {
  const router = Router();
  router.use(authenticate, requirePermission(permissionKey));

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      res.json(await usersService.listUsers(system));
    }),
  );

  // The permission catalog for this system — lets the Team Access checkbox
  // matrix render itself from a single source of truth instead of hardcoding
  // the same list a second time in the frontend.
  router.get(
    '/permissions',
    asyncHandler(async (_req, res) => {
      res.json(permissionsForSystem(system));
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const { username, password, role, permissions } = createUserSchema.parse(req.body);
      res.status(201).json(await usersService.createUser(system, username, password, role, permissions));
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
