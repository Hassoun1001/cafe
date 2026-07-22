import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma';
import { parseLedgerFile, type LedgerRow } from '../lib/ledgerImport';
import { badRequest } from '../lib/errors';

const BUSINESS_START_HOUR = 9;
const MINUTES_BETWEEN_ORDERS = 15;

// The ledger only has a date, not a time — spread same-day rows across a
// plausible business day (09:00 onward, 15 min apart, in entry-number order)
// so daily order counts/trends look realistic instead of stacking at midnight.
function assignSyntheticTimes(rows: LedgerRow[]): Map<number, Date> {
  const byDate = new Map<string, LedgerRow[]>();
  for (const row of rows) {
    const key = row.date.toISOString().slice(0, 10);
    const group = byDate.get(key) ?? [];
    group.push(row);
    byDate.set(key, group);
  }

  const times = new Map<number, Date>();
  for (const group of byDate.values()) {
    group.sort((a, b) => a.entryNumber - b.entryNumber);
    group.forEach((row, i) => {
      const dt = new Date(row.date);
      dt.setUTCHours(BUSINESS_START_HOUR, i * MINUTES_BETWEEN_ORDERS, 0, 0);
      times.set(row.entryNumber, dt);
    });
  }
  return times;
}

export async function importLedgerFile(buffer: Buffer) {
  const { rows, skipped } = parseLedgerFile(buffer);
  if (rows.length === 0) {
    throw badRequest('No recognizable transaction rows found in this file', 'NO_ROWS_FOUND');
  }

  const skippedDetails = skipped.map((s) => s.reason);
  const times = assignSyntheticTimes(rows);

  const existingRefs = await prisma.order.findMany({
    where: { importRef: { in: rows.map((r) => `legacy-${r.entryNumber}`) } },
    select: { importRef: true },
  });
  const existingRefSet = new Set(existingRefs.map((o) => o.importRef));

  const tables = await prisma.cafeTable.findMany({ where: { kind: 'DINING' } });
  const tableByNumber = new Map(tables.map((t) => [t.number, t]));

  // Built up as plain arrays and inserted with two batched createMany calls
  // instead of one `await prisma.order.create()` per row — a large ledger
  // (thousands of rows) awaited one network round trip at a time to a remote
  // DB could take minutes and risk timing out; a couple of batched inserts
  // finish in a fraction of that regardless of row count. createMany has no
  // nested-write support, so each order's id is generated up front and reused
  // for its (single) order item instead of relying on Prisma's auto @default.
  let alreadyImported = 0;
  const ordersToCreate: { id: string; tableId: string; openedAt: Date; closedAt: Date; importRef: string; amount: number }[] = [];
  for (const row of rows) {
    const importRef = `legacy-${row.entryNumber}`;
    if (existingRefSet.has(importRef)) {
      alreadyImported++;
      continue;
    }
    const table = tableByNumber.get(row.tableNumber);
    if (!table) {
      skippedDetails.push(`Invoice #${row.entryNumber}: no dining table numbered ${row.tableNumber}`);
      continue;
    }
    const when = times.get(row.entryNumber) ?? row.date;
    ordersToCreate.push({ id: randomUUID(), tableId: table.id, openedAt: when, closedAt: when, importRef, amount: row.amount });
  }

  if (ordersToCreate.length > 0) {
    await prisma.$transaction([
      prisma.order.createMany({
        data: ordersToCreate.map((o) => ({
          id: o.id,
          tableId: o.tableId,
          status: 'PAID',
          subtotal: o.amount,
          total: o.amount,
          paymentMethod: 'CASH',
          cashReceived: o.amount,
          changeGiven: 0,
          openedAt: o.openedAt,
          closedAt: o.closedAt,
          importRef: o.importRef,
        })),
        skipDuplicates: true,
      }),
      prisma.orderItem.createMany({
        data: ordersToCreate.map((o) => ({ orderId: o.id, nameSnapshot: 'Imported sale (legacy system)', priceSnapshot: o.amount, qty: 1 })),
      }),
    ]);
  }

  return { imported: ordersToCreate.length, alreadyImported, skipped: skippedDetails.length, skippedDetails };
}
