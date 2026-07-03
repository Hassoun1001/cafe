import { prisma } from '../lib/prisma';
import { toNum } from '../lib/decimal';
import { badRequest, notFound } from '../lib/errors';

export async function listTables() {
  const tables = await prisma.cafeTable.findMany({
    orderBy: { number: 'asc' },
    include: {
      orders: {
        where: { status: 'OPEN' },
        include: { items: true },
      },
    },
  });

  return tables.map((t) => {
    const open = t.orders[0];
    const itemCount = open ? open.items.reduce((s, i) => s + i.qty, 0) : 0;
    // Use the order's own stored total (post discount/tax), not a raw item sum,
    // so the table badge matches what the cashier will actually collect.
    const total = open ? toNum(open.total) : 0;
    return {
      id: t.id,
      number: t.number,
      label: t.label,
      active: t.active,
      openOrder: open ? { id: open.id, orderNumber: open.orderNumber, itemCount, total } : null,
    };
  });
}

export async function createTable(data: { number: number; label?: string }) {
  return prisma.cafeTable.create({ data });
}

export async function updateTable(id: string, data: { label?: string; active?: boolean }) {
  const existing = await prisma.cafeTable.findUnique({ where: { id } });
  if (!existing) throw notFound('Table not found');
  return prisma.cafeTable.update({ where: { id }, data });
}

export async function deleteTable(id: string) {
  const existing = await prisma.cafeTable.findFirst({ where: { id }, include: { orders: { where: { status: 'OPEN' } } } });
  if (!existing) throw notFound('Table not found');
  if (existing.orders.length > 0) throw badRequest('Cannot delete a table with an open order', 'TABLE_HAS_OPEN_ORDER');
  await prisma.cafeTable.delete({ where: { id } });
}
