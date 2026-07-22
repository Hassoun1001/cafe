import bcrypt from 'bcryptjs';
import type { AppSystem, UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { badRequest, notFound } from '../lib/errors';
import { validPermissionKeys } from '../lib/permissions';

function serialize(u: { id: string; username: string; role: UserRole; permissions: string[]; active: boolean; createdAt: Date }) {
  return { id: u.id, username: u.username, role: u.role, permissions: u.permissions, active: u.active, createdAt: u.createdAt };
}

// Silently drops anything not in the current catalog rather than rejecting
// the whole request — keeps a stale client (or a permission removed from the
// catalog later) from hard-failing account management instead of just
// ignoring the keys that no longer mean anything.
function sanitizePermissions(system: AppSystem, permissions: string[] | undefined): string[] | undefined {
  if (permissions === undefined) return undefined;
  const valid = validPermissionKeys(system);
  return permissions.filter((p) => valid.has(p));
}

export async function listUsers(system: AppSystem) {
  const users = await prisma.user.findMany({ where: { system }, orderBy: { username: 'asc' } });
  return users.map(serialize);
}

export async function createUser(
  system: AppSystem,
  username: string,
  password: string,
  role: UserRole = 'STAFF',
  permissions: string[] = [],
) {
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { system, username, passwordHash, role, permissions: sanitizePermissions(system, permissions) } });
  return serialize(user);
}

// Never allow removing the last active admin's admin status (demoting,
// deactivating, or deleting) — that would leave nobody able to reach
// Settings or manage accounts again short of a DB console. Distinct from
// "last active user" (deleteUser below) since e.g. 1 admin + 3 staff would
// pass that check while still zeroing out admins.
async function assertNotLastActiveAdmin(system: AppSystem, userId: string) {
  const target = await prisma.user.findFirst({ where: { id: userId, system } });
  if (!target || target.role !== 'ADMIN' || !target.active) return;
  const otherActiveAdmins = await prisma.user.count({ where: { system, role: 'ADMIN', active: true, id: { not: userId } } });
  if (otherActiveAdmins === 0) throw badRequest('Cannot remove the last active admin for this system', 'LAST_ADMIN');
}

export async function updateUser(
  system: AppSystem,
  id: string,
  data: { username?: string; active?: boolean; role?: UserRole; permissions?: string[] },
) {
  const existing = await prisma.user.findFirst({ where: { id, system } });
  if (!existing) throw notFound('User not found');
  const demotingOrDeactivating = (data.role !== undefined && data.role !== 'ADMIN') || data.active === false;
  if (demotingOrDeactivating) await assertNotLastActiveAdmin(system, id);
  return serialize(await prisma.user.update({ where: { id }, data: { ...data, permissions: sanitizePermissions(system, data.permissions) } }));
}

export async function resetUserPassword(system: AppSystem, id: string, newPassword: string) {
  const existing = await prisma.user.findFirst({ where: { id, system } });
  if (!existing) throw notFound('User not found');
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id }, data: { passwordHash } });
}

// Never allow deleting the last active account for a system — that would
// permanently lock everyone out with no way back in short of a DB console.
export async function deleteUser(system: AppSystem, id: string) {
  const existing = await prisma.user.findFirst({ where: { id, system } });
  if (!existing) throw notFound('User not found');
  const remaining = await prisma.user.count({ where: { system, active: true } });
  if (remaining <= 1) throw badRequest('Cannot delete the last active user for this system', 'LAST_USER');
  await assertNotLastActiveAdmin(system, id);
  await prisma.user.delete({ where: { id } });
}
