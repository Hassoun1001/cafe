import { prisma } from '../lib/prisma';
import { toNum } from '../lib/decimal';
import { notFound } from '../lib/errors';

export async function listEmployees() {
  return prisma.employee.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
}

export async function createEmployee(data: { name: string; nameAr?: string }) {
  return prisma.employee.create({ data });
}

export async function updateEmployee(id: string, data: { name?: string; nameAr?: string; active?: boolean }) {
  const existing = await prisma.employee.findUnique({ where: { id } });
  if (!existing) throw notFound('Employee not found');
  return prisma.employee.update({ where: { id }, data });
}

export async function deleteEmployee(id: string) {
  const existing = await prisma.employee.findUnique({ where: { id } });
  if (!existing) throw notFound('Employee not found');
  // Soft-delete: keep past consumption history intact, just hide from active lists.
  await prisma.employee.update({ where: { id }, data: { active: false } });
}

export async function logConsumption(data: {
  employeeId: string;
  itemName: string;
  price: number;
  type: 'FREE' | 'DEDUCT';
}) {
  const employee = await prisma.employee.findUnique({ where: { id: data.employeeId } });
  if (!employee) throw notFound('Employee not found');
  const created = await prisma.employeeConsumption.create({ data });
  return { id: created.id, employeeId: created.employeeId, itemName: created.itemName, price: toNum(created.price), type: created.type };
}

export async function deleteConsumption(id: string) {
  const existing = await prisma.employeeConsumption.findUnique({ where: { id } });
  if (!existing) throw notFound('Log entry not found');
  await prisma.employeeConsumption.delete({ where: { id } });
}

export async function listConsumption() {
  const logs = await prisma.employeeConsumption.findMany({
    include: { employee: true },
    orderBy: { createdAt: 'desc' },
  });

  const summaryMap = new Map<string, { name: string; free: number; deduct: number }>();
  for (const log of logs) {
    const key = log.employeeId;
    const entry = summaryMap.get(key) ?? { name: log.employee.name, free: 0, deduct: 0 };
    if (log.type === 'FREE') entry.free += toNum(log.price);
    else entry.deduct += toNum(log.price);
    summaryMap.set(key, entry);
  }

  return {
    logs: logs.map((l) => ({
      id: l.id,
      date: l.createdAt,
      employee: l.employee.name,
      employeeAr: l.employee.nameAr,
      itemName: l.itemName,
      price: toNum(l.price),
      type: l.type,
    })),
    summary: Array.from(summaryMap.values()),
  };
}
