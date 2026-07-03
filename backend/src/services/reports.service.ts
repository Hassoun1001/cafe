import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { toNum, round2 } from '../lib/decimal';

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

export async function reportsSummary(range: { from?: string; to?: string; groupBy?: ReportGroupBy }) {
  const to = range.to ? new Date(range.to) : new Date();
  const from = range.from ? new Date(range.from) : new Date(to.getTime() - 13 * 24 * 60 * 60 * 1000);
  const groupBy = range.groupBy ?? 'day';

  const where: Prisma.OrderWhereInput = {
    status: 'PAID',
    closedAt: { gte: from, lte: to },
  };

  const orders = await prisma.order.findMany({ where, include: { items: true } });

  const revenue = round2(orders.reduce((s, o) => s + toNum(o.total), 0));
  const orderCount = orders.length;
  const avgOrder = orderCount ? round2(revenue / orderCount) : 0;
  const taxCollected = round2(orders.reduce((s, o) => s + toNum(o.taxAmount), 0));

  const cashTotal = round2(orders.filter((o) => o.paymentMethod === 'CASH').reduce((s, o) => s + toNum(o.total), 0));
  const cardTotal = round2(orders.filter((o) => o.paymentMethod === 'CARD').reduce((s, o) => s + toNum(o.total), 0));

  const employeeConsumptions = await prisma.employeeConsumption.findMany({
    where: { createdAt: { gte: from, lte: to } },
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
  const topItems = Array.from(itemMap.values())
    .map((e) => ({ ...e, revenue: round2(e.revenue) }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);

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
    paymentSplit: { cash: cashTotal, card: cardTotal },
    trend,
    topItems,
    lowStock,
  };
}
