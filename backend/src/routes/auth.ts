import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate } from '../middleware/auth';
import { loginSchema, changePasswordSchema } from '../schemas/auth.schema';
import * as authService from '../services/auth.service';

export const authRouter = Router();

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { password } = loginSchema.parse(req.body);
    const token = await authService.login(password);
    res.json({ token });
  }),
);

authRouter.post(
  '/change-password',
  authenticate,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    await authService.changePassword(currentPassword, newPassword);
    res.json({ ok: true });
  }),
);
