import type { TableKind } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { toNum } from '../lib/decimal';
import { badRequest, notFound } from '../lib/errors';

// Defaults to DINING so every existing Cafe caller (POS table picker,
// Tables page, Settings' Tables card) keeps seeing exactly what it always
// has — the Study system passes its own kinds explicitly.
export async function listTables(kinds: TableKind[] = ['DINING']) {
  const tables = await prisma.cafeTable.findMany({
    where: { kind: { in: kinds } },
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
      kind: t.kind,
      active: t.active,
      openOrder: open ? { id: open.id, orderNumber: open.orderNumber, itemCount, total } : null,
    };
  });
}

export async function createTable(data: { number: number; label?: string; kind?: TableKind }) {
  return prisma.cafeTable.create({ data });
}

export async function updateTable(id: string, data: { label?: string; active?: boolean }) {
  const existing = await prisma.cafeTable.findUnique({ where: { id } });
  if (!existing) throw notFound('Table not found');
  return prisma.cafeTable.update({ where: { id }, data });
}

export async function deleteTable(id: string) {
  const existing = await prisma.cafeTable.findFirst({
    where: { id },
    include: {
      orders: { where: { status: 'OPEN' } },
      studyBookings: { where: { status: 'ACTIVE' } },
    },
  });
  if (!existing) throw notFound('Table not found');
  if (existing.orders.length > 0) throw badRequest('Cannot delete a table with an open order', 'TABLE_HAS_OPEN_ORDER');
  if (existing.studyBookings.length > 0) throw badRequest('Cannot delete a resource with an active booking', 'RESOURCE_HAS_ACTIVE_BOOKING');
  // A table with any order history (even fully paid, closed sales) can't be
  // hard-deleted — Order.tableId has no cascade, so the DB would otherwise
  // reject this with a raw foreign-key error. Renaming/deactivating instead
  // preserves the sales record; only a genuinely never-used table can go.
  const allOrders = await prisma.order.findMany({ where: { tableId: id }, select: { id: true, orderNumber: true, status: true } });
  if (allOrders.length > 0) {
    throw badRequest(
      `Cannot delete a table with sales history — it has past orders on record: ${JSON.stringify(allOrders)}. Rename it instead if it's no longer needed.`,
      'TABLE_HAS_ORDER_HISTORY',
    );
  }
  await prisma.cafeTable.delete({ where: { id } });
}
