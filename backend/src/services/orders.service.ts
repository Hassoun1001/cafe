import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { toNum, round2 } from '../lib/decimal';
import { badRequest, forbidden, notFound } from '../lib/errors';
import { endOfDayExclusive } from '../lib/dates';
import { applyStockForMenuItemSale } from './stock.service';

type TxClient = Prisma.TransactionClient;

const orderInclude = {
  items: true,
  table: true,
  taxes: { orderBy: { sortOrder: 'asc' as const } },
} satisfies Prisma.OrderInclude;

type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

function serializeOrder(order: OrderWithRelations) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    table: { id: order.table.id, number: order.table.number, label: order.table.label },
    items: order.items.map((i) => ({
      id: i.id,
      menuItemId: i.menuItemId,
      name: i.nameSnapshot,
      price: toNum(i.priceSnapshot),
      qty: i.qty,
      lineTotal: round2(i.qty * toNum(i.priceSnapshot)),
    })),
    subtotal: toNum(order.subtotal),
    discountPercent: toNum(order.discountPercent),
    discountAmount: toNum(order.discountAmount),
    taxes: order.taxes.map((t) => ({
      taxRateId: t.taxRateId,
      name: t.name,
      percent: toNum(t.percent),
      compound: t.compound,
      amount: toNum(t.amount),
      manualAmount: t.manualAmount !== null ? toNum(t.manualAmount) : null,
    })),
    taxAmount: toNum(order.taxAmount),
    total: toNum(order.total),
    paymentMethod: order.paymentMethod,
    cashReceived: order.cashReceived !== null ? toNum(order.cashReceived) : null,
    changeGiven: order.changeGiven !== null ? toNum(order.changeGiven) : null,
    openedAt: order.openedAt,
    closedAt: order.closedAt,
  };
}

// recomputeTotals reads the full item/tax list and writes an absolute
// subtotal/total — without this, concurrent mutations on the same order
// (e.g. a cashier tapping several different menu items in quick succession,
// before the previous request has resolved) can interleave: each transaction
// computes its total from a snapshot that doesn't yet include the other's
// still-uncommitted write, and whichever commits last clobbers the other's
// total. Locking the order row for the duration of the transaction forces
// concurrent mutations on the same order to serialize instead of race —
// same category of fix as the earlier stock adjustStock lost-update bug.
async function lockOrder(tx: TxClient, orderId: string) {
  await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
}

async function findOrderOrThrow(id: string) {
  const order = await prisma.order.findUnique({ where: { id }, include: orderInclude });
  if (!order) throw notFound('Order not found');
  return order;
}

// Recomputes subtotal/discount/tax/total for an order from its current line
// items and applied taxes. Taxes are evaluated in sortOrder: a non-compound
// tax is a percentage of the discounted subtotal; a compound tax ("add tax to
// the tax") is a percentage of the immediately preceding APPLIED tax's amount
// instead — e.g. VAT 8.1% on the bill, then a 10% compound tax is 10% of the
// VAT amount itself, not of the bill. A compound tax with nothing before it
// (e.g. toggled on alone) falls back to the discounted subtotal.
// Accepts an optional transaction client so callers that already have their
// line-item/tax change open in a transaction can fold this into the same
// round trip instead of opening a second one — each `await` against a remote
// database (Neon, not localhost) pays real network latency, and this used to
// run as its own separate transaction on every single order mutation.
async function recomputeTotals(orderId: string, client: TxClient | typeof prisma = prisma) {
  const order = await client.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: true, taxes: { orderBy: { sortOrder: 'asc' } } },
  });
  const subtotal = round2(order.items.reduce((s, i) => s + i.qty * toNum(i.priceSnapshot), 0));
  const discountPercent = toNum(order.discountPercent);
  const discountAmount = round2(subtotal * (discountPercent / 100));
  const afterDiscount = round2(subtotal - discountAmount);

  let previousTaxAmount: number | null = null;
  let taxTotal = 0;
  const taxUpdates: { id: string; amount: number }[] = [];
  for (const tax of order.taxes) {
    // A manually-typed amount (e.g. an exact VAT figure off a supplier
    // invoice) overrides the percentage calc entirely, but still feeds into
    // a subsequent compound tax's base the same way a calculated amount would.
    const amount: number =
      tax.manualAmount !== null
        ? round2(toNum(tax.manualAmount))
        : round2((tax.compound && previousTaxAmount !== null ? previousTaxAmount : afterDiscount) * (toNum(tax.percent) / 100));
    taxUpdates.push({ id: tax.id, amount });
    taxTotal = round2(taxTotal + amount);
    previousTaxAmount = amount;
  }
  const total = round2(afterDiscount + taxTotal);

  const writes = [
    ...taxUpdates.map((t) => client.orderTax.update({ where: { id: t.id }, data: { amount: t.amount } })),
    client.order.update({
      where: { id: orderId },
      data: { subtotal, discountAmount, taxAmount: taxTotal, total },
    }),
  ];
  // Already inside the caller's transaction — Prisma doesn't support nested
  // transactions, so just run the writes on that same client/connection.
  // Only wrap in our own transaction when called standalone (no client passed).
  if (client === prisma) {
    await prisma.$transaction(writes);
  } else {
    for (const write of writes) await write;
  }
}

export async function listOpenOrders() {
  const orders = await prisma.order.findMany({
    where: { status: 'OPEN' },
    include: orderInclude,
    orderBy: { openedAt: 'asc' },
  });
  return orders.map(serializeOrder);
}

export async function getOrder(id: string) {
  return serializeOrder(await findOrderOrThrow(id));
}

// Get-or-create: opening a table that already has an open order just returns it,
// so re-selecting a table in the POS never creates a duplicate/orphaned order.
export async function openOrderForTable(tableId: string) {
  const table = await prisma.cafeTable.findUnique({ where: { id: tableId } });
  if (!table) throw notFound('Table not found');

  const existing = await prisma.order.findFirst({ where: { tableId, status: 'OPEN' }, include: orderInclude });
  if (existing) return serializeOrder(existing);

  const defaultTaxes = await prisma.taxRate.findMany({ where: { active: true, defaultOn: true }, orderBy: { sortOrder: 'asc' } });

  return prisma.$transaction(async (tx) => {
    const created = await tx.order.create({ data: { tableId } });
    if (defaultTaxes.length > 0) {
      await lockOrder(tx, created.id);
      await tx.orderTax.createMany({
        data: defaultTaxes.map((t) => ({
          orderId: created.id,
          taxRateId: t.id,
          name: t.name,
          percent: t.percent,
          compound: t.compound,
          sortOrder: t.sortOrder,
        })),
      });
      await recomputeTotals(created.id, tx);
    }
    return serializeOrder(await tx.order.findUniqueOrThrow({ where: { id: created.id }, include: orderInclude }));
  });
}

export async function addItem(orderId: string, menuItemId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw notFound('Order not found');
  if (order.status !== 'OPEN') throw badRequest('Order is not open', 'ORDER_NOT_OPEN');

  const menuItem = await prisma.menuItem.findUnique({ where: { id: menuItemId } });
  if (!menuItem) throw notFound('Menu item not found');

  // Atomic upsert (backed by the @@unique([orderId, menuItemId]) constraint) so
  // rapid repeat taps on the same item always increment one line instead of a
  // read-then-write race creating duplicate lines for the same menu item.
  // Stock deduction, total recompute, and the final read all share this one
  // transaction/connection instead of three separate round trips to the DB —
  // each `await` here pays real network latency against a remote database.
  return prisma.$transaction(async (tx) => {
    await lockOrder(tx, orderId);
    await tx.orderItem.upsert({
      where: { orderId_menuItemId: { orderId, menuItemId } },
      create: { orderId, menuItemId, nameSnapshot: menuItem.name, priceSnapshot: menuItem.price, qty: 1 },
      update: { qty: { increment: 1 } },
    });
    await applyStockForMenuItemSale(tx, menuItemId, 1);
    await recomputeTotals(orderId, tx);
    return serializeOrder(await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude }));
  });
}

export async function setLineQty(orderId: string, lineId: string, qty: number) {
  const order = await findOrderOrThrow(orderId);
  if (order.status !== 'OPEN') throw badRequest('Order is not open', 'ORDER_NOT_OPEN');
  const line = order.items.find((i) => i.id === lineId);
  if (!line) throw notFound('Order line not found');

  const deltaQty = qty - line.qty;
  return prisma.$transaction(async (tx) => {
    await lockOrder(tx, orderId);
    if (qty <= 0) {
      await tx.orderItem.delete({ where: { id: lineId } });
    } else {
      await tx.orderItem.update({ where: { id: lineId }, data: { qty } });
    }
    // Positive delta = more sold (deduct); negative = less sold (restore).
    await applyStockForMenuItemSale(tx, line.menuItemId, qty <= 0 ? -line.qty : deltaQty);
    await recomputeTotals(orderId, tx);
    return serializeOrder(await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude }));
  });
}

export async function removeLine(orderId: string, lineId: string) {
  const order = await findOrderOrThrow(orderId);
  if (order.status !== 'OPEN') throw badRequest('Order is not open', 'ORDER_NOT_OPEN');
  const line = order.items.find((i) => i.id === lineId);
  if (!line) throw notFound('Order line not found');
  return prisma.$transaction(async (tx) => {
    await lockOrder(tx, orderId);
    await tx.orderItem.delete({ where: { id: lineId } });
    await applyStockForMenuItemSale(tx, line.menuItemId, -line.qty);
    await recomputeTotals(orderId, tx);
    return serializeOrder(await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude }));
  });
}

export async function patchOrder(orderId: string, data: { discountPercent?: number }) {
  const order = await findOrderOrThrow(orderId);
  if (order.status !== 'OPEN') throw badRequest('Order is not open', 'ORDER_NOT_OPEN');
  return prisma.$transaction(async (tx) => {
    await lockOrder(tx, orderId);
    await tx.order.update({ where: { id: orderId }, data });
    await recomputeTotals(orderId, tx);
    return serializeOrder(await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude }));
  });
}

export async function addTaxToOrder(orderId: string, taxRateId: string) {
  const order = await findOrderOrThrow(orderId);
  if (order.status !== 'OPEN') throw badRequest('Order is not open', 'ORDER_NOT_OPEN');
  const taxRate = await prisma.taxRate.findUnique({ where: { id: taxRateId } });
  if (!taxRate) throw notFound('Tax rate not found');

  return prisma.$transaction(async (tx) => {
    await lockOrder(tx, orderId);
    // Re-checked after the lock (not just the pre-transaction `order` above) —
    // a concurrent request could have applied this same tax while we were
    // waiting for the lock, and the unique constraint would otherwise 500.
    const alreadyApplied = await tx.orderTax.findUnique({ where: { orderId_taxRateId: { orderId, taxRateId } } });
    if (!alreadyApplied) {
      await tx.orderTax.create({
        data: {
          orderId,
          taxRateId: taxRate.id,
          name: taxRate.name,
          percent: taxRate.percent,
          compound: taxRate.compound,
          sortOrder: taxRate.sortOrder,
        },
      });
    }
    await recomputeTotals(orderId, tx);
    return serializeOrder(await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude }));
  });
}

export async function removeTaxFromOrder(orderId: string, taxRateId: string) {
  const order = await findOrderOrThrow(orderId);
  if (order.status !== 'OPEN') throw badRequest('Order is not open', 'ORDER_NOT_OPEN');
  return prisma.$transaction(async (tx) => {
    await lockOrder(tx, orderId);
    await tx.orderTax.deleteMany({ where: { orderId, taxRateId } });
    await recomputeTotals(orderId, tx);
    return serializeOrder(await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude }));
  });
}

// Pins an already-applied tax to a typed-in amount instead of its
// percentage calc (e.g. the cashier reads the exact VAT figure off a
// supplier invoice) — pass null to go back to auto-calculating from percent.
export async function setOrderTaxManualAmount(orderId: string, taxRateId: string, manualAmount: number | null) {
  const order = await findOrderOrThrow(orderId);
  if (order.status !== 'OPEN') throw badRequest('Order is not open', 'ORDER_NOT_OPEN');
  return prisma.$transaction(async (tx) => {
    await lockOrder(tx, orderId);
    const updated = await tx.orderTax.updateMany({ where: { orderId, taxRateId }, data: { manualAmount } });
    if (updated.count === 0) throw notFound('This tax is not applied to the order');
    await recomputeTotals(orderId, tx);
    return serializeOrder(await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude }));
  });
}

// A drink ordered during a Study booking is a real Order on that resource's
// linked table — paid/voided through this exact same Cafe flow (tax, receipt,
// Sales history) as any dining order, deliberately not auto-settled from the
// Study side. If that order belongs to a StudyBooking whose room/table fee
// has already been checked out Study-side (`paid: true`), settling the order
// here is the second half of that booking's checkout — finalize it so the
// resource becomes free again. If the room fee hasn't been paid yet, this
// order being settled isn't enough on its own; the booking stays ACTIVE
// (still occupying the resource) until the Study side also checks out.
async function completeLinkedStudyBookingIfReady(orderId: string) {
  const booking = await prisma.studyBooking.findUnique({ where: { cafeOrderId: orderId } });
  if (booking && booking.status === 'ACTIVE' && booking.paid) {
    await prisma.studyBooking.update({ where: { id: booking.id }, data: { status: 'COMPLETED' } });
  }
}

export async function payOrder(orderId: string, method: 'CASH' | 'CARD', cashReceived?: number) {
  const order = await findOrderOrThrow(orderId);
  if (order.status !== 'OPEN') throw badRequest('Order is not open', 'ORDER_NOT_OPEN');
  if (order.items.length === 0) throw badRequest('Cannot pay an empty order', 'ORDER_EMPTY');

  const total = toNum(order.total);
  if (method === 'CASH' && (cashReceived === undefined || cashReceived < total)) {
    throw badRequest('Cash received is less than the total due', 'INSUFFICIENT_CASH');
  }
  const changeGiven = method === 'CASH' ? round2((cashReceived as number) - total) : null;

  const paid = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: 'PAID',
      paymentMethod: method,
      cashReceived: method === 'CASH' ? cashReceived : null,
      changeGiven,
      closedAt: new Date(),
    },
    include: orderInclude,
  });
  await completeLinkedStudyBookingIfReady(orderId);
  return serializeOrder(paid);
}

// Open orders are soft-cancelled (kept for audit) after restoring any stock
// already deducted for their lines; paid orders are hard-deleted from history,
// matching the prototype's "delete sale" report action (stock already sold is
// not restored when voiding a historical sale). Voiding an OPEN order is a
// routine staff task ("Clear table" — order was a mistake, customer walked
// out); hard-deleting a PAID order erases real sales history, so that branch
// requires the caller's role to be ADMIN. `role` is only checked when it's
// actually needed (the hard-delete branch) — internal callers (Study
// booking cancel/delete) only ever hit the OPEN branch, so they don't need
// to pass one.
export async function deleteOrder(orderId: string, canDeleteHistorical = false) {
  const order = await findOrderOrThrow(orderId);
  if (order.status === 'OPEN') {
    await prisma.$transaction(async (tx) => {
      for (const line of order.items) {
        await applyStockForMenuItemSale(tx, line.menuItemId, -line.qty);
      }
      await tx.order.update({ where: { id: orderId }, data: { status: 'CANCELLED', closedAt: new Date() } });
    });
    await completeLinkedStudyBookingIfReady(orderId);
    return;
  }
  if (!canDeleteHistorical) throw forbidden("You don't have permission to delete a historical sale", 'PERMISSION_REQUIRED');
  await prisma.order.delete({ where: { id: orderId } });
}

// Records a sale that actually happened at some point in the past (e.g. a
// bill closed yesterday in a different/legacy system) with its real item
// list, discount, and taxes, backdated to that time — a Reports page tool,
// not a POS flow, but a routine staff task rather than an admin-only
// correction. Deducts stock for any item tied to a real menu item, exactly
// like a live POS sale (applyStockForMenuItemSale) — the physical stock for
// this sale hasn't been accounted for yet just because it's being entered
// late; free-text items (no menuItemId) have no recipe to deduct, same as
// they would on a live order. Reuses recomputeTotals for the actual
// subtotal/discount/tax/total math so a manual entry is calculated exactly
// the same way a live POS sale would be, instead of a second parallel
// implementation that could drift out of sync.
export async function createManualOrder(input: {
  tableId: string;
  items: { menuItemId?: string; name: string; price: number; qty: number }[];
  discountPercent?: number;
  taxes?: { taxRateId: string; manualAmount?: number | null }[];
  paymentMethod: 'CASH' | 'CARD';
  cashReceived?: number;
  closedAt: string;
}) {
  const table = await prisma.cafeTable.findUnique({ where: { id: input.tableId } });
  if (!table) throw notFound('Table not found');

  const closedAt = new Date(input.closedAt);
  if (Number.isNaN(closedAt.getTime())) throw badRequest('Invalid date/time', 'INVALID_DATE');

  const taxInputs = input.taxes ?? [];
  const taxRates = taxInputs.length ? await prisma.taxRate.findMany({ where: { id: { in: taxInputs.map((t) => t.taxRateId) } } }) : [];
  const manualAmountByTaxRateId = new Map(taxInputs.map((t) => [t.taxRateId, t.manualAmount ?? null]));

  return prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        tableId: input.tableId,
        discountPercent: input.discountPercent ?? 0,
        openedAt: closedAt,
        items: {
          create: input.items.map((i) => ({
            menuItemId: i.menuItemId ?? null,
            nameSnapshot: i.name,
            priceSnapshot: i.price,
            qty: i.qty,
          })),
        },
        taxes: taxRates.length
          ? {
              create: taxRates.map((t) => ({
                taxRateId: t.id,
                name: t.name,
                percent: t.percent,
                compound: t.compound,
                sortOrder: t.sortOrder,
                manualAmount: manualAmountByTaxRateId.get(t.id) ?? null,
              })),
            }
          : undefined,
      },
    });
    for (const item of input.items) {
      if (item.menuItemId) await applyStockForMenuItemSale(tx, item.menuItemId, item.qty);
    }
    await recomputeTotals(created.id, tx);

    const withTotals = await tx.order.findUniqueOrThrow({ where: { id: created.id } });
    const total = toNum(withTotals.total);
    if (input.paymentMethod === 'CASH' && (input.cashReceived === undefined || input.cashReceived < total)) {
      throw badRequest('Cash received is less than the total due', 'INSUFFICIENT_CASH');
    }
    const changeGiven = input.paymentMethod === 'CASH' ? round2((input.cashReceived as number) - total) : null;

    const paid = await tx.order.update({
      where: { id: created.id },
      data: {
        status: 'PAID',
        paymentMethod: input.paymentMethod,
        cashReceived: input.paymentMethod === 'CASH' ? input.cashReceived : null,
        changeGiven,
        closedAt,
      },
      include: orderInclude,
    });
    return serializeOrder(paid);
  });
}

// Edits an already-recorded sale in place — same shape as createManualOrder,
// but for correcting a mistake in a sale that's already PAID (including a
// legacy-imported one), rather than entering a new one. Not usable on an
// OPEN order — that's what the live POS screen is for. Old items' stock
// impact is fully reversed and the new items' stock impact reapplied, the
// same way deleting an OPEN order restores stock — otherwise correcting a
// sale's items would silently double-count or drop stock.
export async function updateManualOrder(
  orderId: string,
  input: {
    tableId: string;
    items: { menuItemId?: string; name: string; price: number; qty: number }[];
    discountPercent?: number;
    taxes?: { taxRateId: string; manualAmount?: number | null }[];
    paymentMethod: 'CASH' | 'CARD';
    cashReceived?: number;
    closedAt: string;
  },
) {
  const existing = await findOrderOrThrow(orderId);
  if (existing.status === 'OPEN') throw badRequest('Use the Cashier screen to edit an open order', 'ORDER_OPEN');

  const table = await prisma.cafeTable.findUnique({ where: { id: input.tableId } });
  if (!table) throw notFound('Table not found');

  const closedAt = new Date(input.closedAt);
  if (Number.isNaN(closedAt.getTime())) throw badRequest('Invalid date/time', 'INVALID_DATE');

  const taxInputs = input.taxes ?? [];
  const taxRates = taxInputs.length ? await prisma.taxRate.findMany({ where: { id: { in: taxInputs.map((t) => t.taxRateId) } } }) : [];
  const manualAmountByTaxRateId = new Map(taxInputs.map((t) => [t.taxRateId, t.manualAmount ?? null]));

  return prisma.$transaction(async (tx) => {
    await lockOrder(tx, orderId);
    for (const line of existing.items) {
      await applyStockForMenuItemSale(tx, line.menuItemId, -line.qty);
    }
    await tx.orderItem.deleteMany({ where: { orderId } });
    await tx.orderTax.deleteMany({ where: { orderId } });

    await tx.order.update({
      where: { id: orderId },
      data: {
        tableId: input.tableId,
        discountPercent: input.discountPercent ?? 0,
        openedAt: closedAt,
        items: {
          create: input.items.map((i) => ({
            menuItemId: i.menuItemId ?? null,
            nameSnapshot: i.name,
            priceSnapshot: i.price,
            qty: i.qty,
          })),
        },
        taxes: taxRates.length
          ? {
              create: taxRates.map((t) => ({
                taxRateId: t.id,
                name: t.name,
                percent: t.percent,
                compound: t.compound,
                sortOrder: t.sortOrder,
                manualAmount: manualAmountByTaxRateId.get(t.id) ?? null,
              })),
            }
          : undefined,
      },
    });
    for (const item of input.items) {
      if (item.menuItemId) await applyStockForMenuItemSale(tx, item.menuItemId, item.qty);
    }
    await recomputeTotals(orderId, tx);

    const withTotals = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    const total = toNum(withTotals.total);
    if (input.paymentMethod === 'CASH' && (input.cashReceived === undefined || input.cashReceived < total)) {
      throw badRequest('Cash received is less than the total due', 'INSUFFICIENT_CASH');
    }
    const changeGiven = input.paymentMethod === 'CASH' ? round2((input.cashReceived as number) - total) : null;

    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        status: 'PAID',
        paymentMethod: input.paymentMethod,
        cashReceived: input.paymentMethod === 'CASH' ? input.cashReceived : null,
        changeGiven,
        closedAt,
      },
      include: orderInclude,
    });
    return serializeOrder(updated);
  });
}

export async function listSalesHistory(filters: {
  from?: string;
  to?: string;
  table?: number;
  payment?: 'CASH' | 'CARD';
  status?: 'PAID' | 'CANCELLED';
  page: number;
  pageSize: number;
}) {
  const where: Prisma.OrderWhereInput = { status: filters.status ?? 'PAID' };
  if (filters.from || filters.to) {
    where.closedAt = {};
    if (filters.from) where.closedAt.gte = new Date(filters.from);
    // `to` is a date-only string (e.g. "2026-07-04") — parsed directly it's
    // midnight UTC, so `lte` against it would exclude nearly the whole day.
    // Use the start of the next day with `lt` so the given day is fully included.
    if (filters.to) where.closedAt.lt = endOfDayExclusive(filters.to);
  }
  if (filters.payment) where.paymentMethod = filters.payment;
  if (filters.table) where.table = { number: filters.table };

  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      include: orderInclude,
      orderBy: { closedAt: 'desc' },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
  ]);

  return { total, page: filters.page, pageSize: filters.pageSize, orders: orders.map(serializeOrder) };
}
