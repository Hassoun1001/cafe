import { Router, RequestHandler } from 'express';
import type { AppSystem } from '@prisma/client';
import { asyncHandler } from '../middleware/asyncHandler';
import { loginSchema, changePasswordSchema } from '../schemas/auth.schema';
import * as authService from '../services/auth.service';

// Shared by both apps — `system` picks which User pool a login/password
// change targets, `authenticate` is that system's own auth middleware
// (a Cafe token can never satisfy the Study router's change-password check).
export function createAuthRouter(system: AppSystem, authenticate: RequestHandler) {
  const router = Router();

  router.post(
    '/login',
    asyncHandler(async (req, res) => {
      const { username, password } = loginSchema.parse(req.body);
      const token = await authService.login(system, username, password);
      res.json({ token });
    }),
  );

  router.post(
    '/change-password',
    authenticate,
    asyncHandler(async (req, res) => {
      const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
      await authService.changeOwnPassword(req.user!.id, currentPassword, newPassword);
      res.json({ ok: true });
    }),
  );

  return router;
}
