import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { toNum, round2 } from '../lib/decimal';
import { endOfDayExclusive } from '../lib/dates';

export type ReportGroupBy = 'day' | 'week' | 'month';

// Buckets a date into a label for the trend chart. 'week' truncates to the
// Monday of that ISO week; 'month' truncates to the 1st of the month.
function bucketKey(d: Date, groupBy: ReportGroupBy): string {
  if (groupBy === 'month') return d.toISOString().slice(0, 7);
  if (groupBy === 'week') {
    const monday = new Date(d);
    const isoDay = (d.getUTCDay() + 6) % 7; // 0 = Monday
    monday.setUTCDate(d.getUTCDate() - isoDay);
    return monday.toISOString().slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

// `to` is a date-only string (e.g. "2026-07-04" for "Today") — parsed
// directly it's midnight UTC, so a `lte` comparison against it would
// exclude nearly the entire day. Use the start of the *next* day with `lt`
// instead, so the given day is fully included. Shared by every report that
// takes a from/to range so they all agree on what "today" means.
function resolveDateRange(range: { from?: string; to?: string }) {
  const to = range.to ? endOfDayExclusive(range.to) : new Date();
  const from = range.from ? new Date(range.from) : new Date(to.getTime() - 13 * 24 * 60 * 60 * 1000);
  return { from, to };
}

export async function reportsSummary(range: { from?: string; to?: string; groupBy?: ReportGroupBy }) {
  const { from, to } = resolveDateRange(range);
  const groupBy = range.groupBy ?? 'day';

  const where: Prisma.OrderWhereInput = {
    status: 'PAID',
    closedAt: { gte: from, lt: to },
  };

  const orders = await prisma.order.findMany({ where, include: { items: true } });

  const revenue = round2(orders.reduce((s, o) => s + toNum(o.total), 0));
  const orderCount = orders.length;
  const avgOrder = orderCount ? round2(revenue / orderCount) : 0;
  const taxCollected = round2(orders.reduce((s, o) => s + toNum(o.taxAmount), 0));

  const cashTotal = round2(orders.filter((o) => o.paymentMethod === 'CASH').reduce((s, o) => s + toNum(o.total), 0));
  const cardTotal = round2(orders.filter((o) => o.paymentMethod === 'CARD').reduce((s, o) => s + toNum(o.total), 0));

  // Cash handed back to customers on overpayment (e.g. a 10,000 bill paid
  // with 15,000 leaves 5,000 change) — tracked separately from revenue since
  // it's cash that left the register but was never actually earned.
  const changeGiven = round2(
    orders.filter((o) => o.paymentMethod === 'CASH').reduce((s, o) => s + (o.changeGiven ? toNum(o.changeGiven) : 0), 0),
  );

  const employeeConsumptions = await prisma.employeeConsumption.findMany({
    where: { createdAt: { gte: from, lt: to } },
  });
  const employeeCost = round2(employeeConsumptions.reduce((s, e) => s + toNum(e.price), 0));

  const trendMap = new Map<string, number>();
  for (const o of orders) {
    if (!o.closedAt) continue;
    const key = bucketKey(o.closedAt, groupBy);
    trendMap.set(key, (trendMap.get(key) ?? 0) + toNum(o.total));
  }
  const trend = Array.from(trendMap.entries())
    .map(([date, total]) => ({ date, total: round2(total) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const itemMap = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const o of orders) {
    for (const i of o.items) {
      const entry = itemMap.get(i.nameSnapshot) ?? { name: i.nameSnapshot, qty: 0, revenue: 0 };
      entry.qty += i.qty;
      entry.revenue += i.qty * toNum(i.priceSnapshot);
      itemMap.set(i.nameSnapshot, entry);
    }
  }
  // Full per-item breakdown for the whole range — lets the Reports page
  // answer "how much did we sell of item X" for any item, not just the top
  // sellers. `topItems` (below) is just this same data, sliced.
  const itemSales = Array.from(itemMap.values())
    .map((e) => ({ ...e, revenue: round2(e.revenue) }))
    .sort((a, b) => b.revenue - a.revenue);
  const topItems = [...itemSales].sort((a, b) => b.qty - a.qty).slice(0, 10);

  const lowStockItems = await prisma.stockItem.findMany();
  const lowStock = lowStockItems
    .filter((s) => toNum(s.qty) <= toNum(s.minQty))
    .map((s) => ({ id: s.id, name: s.name, qty: toNum(s.qty), unit: s.unit, minQty: toNum(s.minQty) }));

  return {
    range: { from: from.toISOString(), to: to.toISOString() },
    groupBy,
    revenue,
    orderCount,
    avgOrder,
    taxCollected,
    employeeCost,
    changeGiven,
    paymentSplit: { cash: cashTotal, card: cardTotal },
    trend,
    topItems,
    itemSales,
    lowStock,
  };
}

export interface ItemSalesReport {
  range: { from: string; to: string };
  item: string | null;
  totalQty: number;
  totalRevenue: number;
  rows: { name: string; qty: number; revenue: number }[] | { date: string; qty: number; revenue: number }[];
}

// Backs the Reports page's "Item sales" export. With no `item`, returns the
// same full per-item qty/revenue breakdown as `reportsSummary.itemSales`
// (every item sold in the range). With `item`, narrows to that one item and
// buckets it by day instead — a single qty/revenue row wouldn't be much of a
// "report" on its own, so picking one item trades the item-by-item breadth
// for a day-by-day trend of just that item.
export async function itemSalesReport(range: { from?: string; to?: string }, item?: string): Promise<ItemSalesReport> {
  const { from, to } = resolveDateRange(range);
  const orders = await prisma.order.findMany({
    where: { status: 'PAID', closedAt: { gte: from, lt: to } },
    include: { items: true },
  });

  if (!item) {
    const itemMap = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const o of orders) {
      for (const i of o.items) {
        const entry = itemMap.get(i.nameSnapshot) ?? { name: i.nameSnapshot, qty: 0, revenue: 0 };
        entry.qty += i.qty;
        entry.revenue += i.qty * toNum(i.priceSnapshot);
        itemMap.set(i.nameSnapshot, entry);
      }
    }
    const rows = Array.from(itemMap.values())
      .map((e) => ({ ...e, revenue: round2(e.revenue) }))
      .sort((a, b) => b.revenue - a.revenue);
    return {
      range: { from: from.toISOString(), to: to.toISOString() },
      item: null,
      rows,
      totalQty: rows.reduce((s, r) => s + r.qty, 0),
      totalRevenue: round2(rows.reduce((s, r) => s + r.revenue, 0)),
    };
  }

  const dayMap = new Map<string, { date: string; qty: number; revenue: number }>();
  for (const o of orders) {
    if (!o.closedAt) continue;
    for (const i of o.items.filter((i) => i.nameSnapshot === item)) {
      const key = o.closedAt.toISOString().slice(0, 10);
      const entry = dayMap.get(key) ?? { date: key, qty: 0, revenue: 0 };
      entry.qty += i.qty;
      entry.revenue += i.qty * toNum(i.priceSnapshot);
      dayMap.set(key, entry);
    }
  }
  const rows = Array.from(dayMap.values())
    .map((e) => ({ ...e, revenue: round2(e.revenue) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return {
    range: { from: from.toISOString(), to: to.toISOString() },
    item,
    rows,
    totalQty: rows.reduce((s, r) => s + r.qty, 0),
    totalRevenue: round2(rows.reduce((s, r) => s + r.revenue, 0)),
  };
}
