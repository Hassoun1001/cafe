import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { toNum, round2 } from '../lib/decimal';
import { badRequest, notFound } from '../lib/errors';
import { applyStockForMenuItemSale } from './stock.service';

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
async function recomputeTotals(orderId: string) {
  const order = await prisma.order.findUniqueOrThrow({
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
    const base = tax.compound && previousTaxAmount !== null ? previousTaxAmount : afterDiscount;
    const amount = round2(base * (toNum(tax.percent) / 100));
    taxUpdates.push({ id: tax.id, amount });
    taxTotal = round2(taxTotal + amount);
    previousTaxAmount = amount;
  }
  const total = round2(afterDiscount + taxTotal);

  await prisma.$transaction([
    ...taxUpdates.map((t) => prisma.orderTax.update({ where: { id: t.id }, data: { amount: t.amount } })),
    prisma.order.update({
      where: { id: orderId },
      data: { subtotal, discountAmount, taxAmount: taxTotal, total },
    }),
  ]);
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

  const created = await prisma.order.create({ data: { tableId }, include: orderInclude });

  const defaultTaxes = await prisma.taxRate.findMany({ where: { active: true, defaultOn: true }, orderBy: { sortOrder: 'asc' } });
  if (defaultTaxes.length > 0) {
    await prisma.orderTax.createMany({
      data: defaultTaxes.map((t) => ({
        orderId: created.id,
        taxRateId: t.id,
        name: t.name,
        percent: t.percent,
        compound: t.compound,
        sortOrder: t.sortOrder,
      })),
    });
    await recomputeTotals(created.id);
  }
  return getOrder(created.id);
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
  // Stock deduction for the item's recipe runs in the same transaction so an
  // order line and its stock impact never drift apart.
  await prisma.$transaction(async (tx) => {
    await tx.orderItem.upsert({
      where: { orderId_menuItemId: { orderId, menuItemId } },
      create: { orderId, menuItemId, nameSnapshot: menuItem.name, priceSnapshot: menuItem.price, qty: 1 },
      update: { qty: { increment: 1 } },
    });
    await applyStockForMenuItemSale(tx, menuItemId, 1);
  });
  await recomputeTotals(orderId);
  return getOrder(orderId);
}

export async function setLineQty(orderId: string, lineId: string, qty: number) {
  const order = await findOrderOrThrow(orderId);
  if (order.status !== 'OPEN') throw badRequest('Order is not open', 'ORDER_NOT_OPEN');
  const line = order.items.find((i) => i.id === lineId);
  if (!line) throw notFound('Order line not found');

  const deltaQty = qty - line.qty;
  await prisma.$transaction(async (tx) => {
    if (qty <= 0) {
      await tx.orderItem.delete({ where: { id: lineId } });
    } else {
      await tx.orderItem.update({ where: { id: lineId }, data: { qty } });
    }
    // Positive delta = more sold (deduct); negative = less sold (restore).
    await applyStockForMenuItemSale(tx, line.menuItemId, qty <= 0 ? -line.qty : deltaQty);
  });
  await recomputeTotals(orderId);
  return getOrder(orderId);
}

export async function removeLine(orderId: string, lineId: string) {
  const order = await findOrderOrThrow(orderId);
  if (order.status !== 'OPEN') throw badRequest('Order is not open', 'ORDER_NOT_OPEN');
  const line = order.items.find((i) => i.id === lineId);
  if (!line) throw notFound('Order line not found');
  await prisma.$transaction(async (tx) => {
    await tx.orderItem.delete({ where: { id: lineId } });
    await applyStockForMenuItemSale(tx, line.menuItemId, -line.qty);
  });
  await recomputeTotals(orderId);
  return getOrder(orderId);
}

export async function patchOrder(orderId: string, data: { discountPercent?: number }) {
  const order = await findOrderOrThrow(orderId);
  if (order.status !== 'OPEN') throw badRequest('Order is not open', 'ORDER_NOT_OPEN');
  await prisma.order.update({ where: { id: orderId }, data });
  await recomputeTotals(orderId);
  return getOrder(orderId);
}

export async function addTaxToOrder(orderId: string, taxRateId: string) {
  const order = await findOrderOrThrow(orderId);
  if (order.status !== 'OPEN') throw badRequest('Order is not open', 'ORDER_NOT_OPEN');
  const taxRate = await prisma.taxRate.findUnique({ where: { id: taxRateId } });
  if (!taxRate) throw notFound('Tax rate not found');

  const alreadyApplied = order.taxes.some((t) => t.taxRateId === taxRateId);
  if (!alreadyApplied) {
    await prisma.orderTax.create({
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
  await recomputeTotals(orderId);
  return getOrder(orderId);
}

export async function removeTaxFromOrder(orderId: string, taxRateId: string) {
  const order = await findOrderOrThrow(orderId);
  if (order.status !== 'OPEN') throw badRequest('Order is not open', 'ORDER_NOT_OPEN');
  await prisma.orderTax.deleteMany({ where: { orderId, taxRateId } });
  await recomputeTotals(orderId);
  return getOrder(orderId);
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

  await prisma.order.update({
    where: { id: orderId },
    data: {
      status: 'PAID',
      paymentMethod: method,
      cashReceived: method === 'CASH' ? cashReceived : null,
      changeGiven,
      closedAt: new Date(),
    },
  });
  return getOrder(orderId);
}

// Open orders are soft-cancelled (kept for audit) after restoring any stock
// already deducted for their lines; paid orders are hard-deleted from history,
// matching the prototype's "delete sale" report action (stock already sold is
// not restored when voiding a historical sale).
export async function deleteOrder(orderId: string) {
  const order = await findOrderOrThrow(orderId);
  if (order.status === 'OPEN') {
    await prisma.$transaction(async (tx) => {
      for (const line of order.items) {
        await applyStockForMenuItemSale(tx, line.menuItemId, -line.qty);
      }
      await tx.order.update({ where: { id: orderId }, data: { status: 'CANCELLED', closedAt: new Date() } });
    });
    return;
  }
  await prisma.order.delete({ where: { id: orderId } });
}

export async function listSalesHistory(filters: {
  from?: string;
  to?: string;
  table?: number;
  payment?: 'CASH' | 'CARD';
  page: number;
  pageSize: number;
}) {
  const where: Prisma.OrderWhereInput = { status: 'PAID' };
  if (filters.from || filters.to) {
    where.closedAt = {};
    if (filters.from) where.closedAt.gte = new Date(filters.from);
    if (filters.to) where.closedAt.lte = new Date(filters.to);
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
