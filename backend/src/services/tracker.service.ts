import { StockAdjustReason } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { toNum, round2 } from '../lib/decimal';

export async function currentStockForTracker() {
  const items = await prisma.stockItem.findMany({ orderBy: { name: 'asc' } });
  return items.map((i) => ({ id: i.id, name: i.name, nameAr: i.nameAr, unit: i.unit, systemQty: toNum(i.qty) }));
}

// Saving a physical count is a real stock take: it both records the
// system-vs-physical discrepancy for history AND reconciles the system qty to
// match what was physically counted (with a StockAdjustment audit row), so
// the tracker actually corrects drift instead of just observing it.
export async function saveCounts(counts: { stockItemId: string; physicalQty: number }[]) {
  const items = await prisma.stockItem.findMany({ where: { id: { in: counts.map((c) => c.stockItemId) } } });
  const byId = new Map(items.map((i) => [i.id, i]));

  const rows = counts
    .filter((c) => byId.has(c.stockItemId))
    .map((c) => {
      const item = byId.get(c.stockItemId)!;
      const systemQty = toNum(item.qty);
      return {
        stockItemId: c.stockItemId,
        systemQty,
        physicalQty: c.physicalQty,
        diff: round2(c.physicalQty - systemQty),
      };
    });

  await prisma.$transaction([
    ...rows.map((r) => prisma.stockCount.create({ data: r })),
    ...rows.map((r) => prisma.stockItem.update({ where: { id: r.stockItemId }, data: { qty: r.physicalQty } })),
    ...rows.map((r) =>
      prisma.stockAdjustment.create({
        data: {
          stockItemId: r.stockItemId,
          delta: r.diff,
          resultingQty: r.physicalQty,
          reason: StockAdjustReason.TRACKER_CORRECTION,
          note: 'Weekly stock tracker reconciliation',
        },
      }),
    ),
  ]);
  return rows.length;
}

export async function trackerHistory() {
  const history = await prisma.stockCount.findMany({
    include: { stockItem: true },
    orderBy: { countedAt: 'desc' },
    take: 500,
  });
  return history.map((h) => ({
    id: h.id,
    date: h.countedAt,
    item: h.stockItem.name,
    system: toNum(h.systemQty),
    physical: toNum(h.physicalQty),
    diff: toNum(h.diff),
  }));
}
