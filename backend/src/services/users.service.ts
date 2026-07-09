import bcrypt from 'bcryptjs';
import type { AppSystem } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { badRequest, notFound } from '../lib/errors';

function serialize(u: { id: string; username: string; active: boolean; createdAt: Date }) {
  return { id: u.id, username: u.username, active: u.active, createdAt: u.createdAt };
}

export async function listUsers(system: AppSystem) {
  const users = await prisma.user.findMany({ where: { system }, orderBy: { username: 'asc' } });
  return users.map(serialize);
}

export async function createUser(system: AppSystem, username: string, password: string) {
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { system, username, passwordHash } });
  return serialize(user);
}

export async function updateUser(system: AppSystem, id: string, data: { username?: string; active?: boolean }) {
  const existing = await prisma.user.findFirst({ where: { id, system } });
  if (!existing) throw notFound('User not found');
  return serialize(await prisma.user.update({ where: { id }, data }));
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
  await prisma.user.delete({ where: { id } });
}
