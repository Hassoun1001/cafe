import bcrypt from 'bcryptjs';
import type { AppSystem } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { signSessionToken } from '../lib/jwt';
import { unauthorized } from '../lib/errors';

export async function login(system: AppSystem, username: string, password: string): Promise<string> {
  const user = await prisma.user.findFirst({ where: { system, username, active: true } });
  if (!user) throw unauthorized('Invalid username or password', 'INVALID_CREDENTIALS');
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw unauthorized('Invalid username or password', 'INVALID_CREDENTIALS');
  return signSessionToken({ id: user.id, username: user.username, system: user.system, role: user.role });
}

export async function changeOwnPassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) throw unauthorized('Current password is incorrect', 'WRONG_PASSWORD');
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}
