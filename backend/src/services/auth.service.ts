import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { signSessionToken } from '../lib/jwt';
import { unauthorized } from '../lib/errors';
import { getAppConfig } from './config.service';

export async function login(password: string): Promise<string> {
  const cfg = await getAppConfig();
  const ok = await bcrypt.compare(password, cfg.passwordHash);
  if (!ok) {
    throw unauthorized('Wrong password', 'WRONG_PASSWORD');
  }
  return signSessionToken();
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const cfg = await getAppConfig();
  const ok = await bcrypt.compare(currentPassword, cfg.passwordHash);
  if (!ok) {
    throw unauthorized('Current password is incorrect', 'WRONG_PASSWORD');
  }
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.appConfig.update({ where: { id: cfg.id }, data: { passwordHash } });
}
