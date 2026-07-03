import { Prisma, StockAdjustReason } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { toNum } from '../lib/decimal';
import { badRequest, notFound } from '../lib/errors';

type TxClient = Prisma.TransactionClient;

function serialize(item: {
  id: string;
  name: string;
  nameAr: string | null;
  category: string;
  unit: string;
  qty: unknown;
  minQty: unknown;
  costPerUnit: unknown;
}) {
  return {
    id: item.id,
    name: item.name,
    nameAr: item.nameAr,
    category: item.category,
    unit: item.unit,
    qty: toNum(item.qty as never),
    minQty: toNum(item.minQty as never),
    costPerUnit: toNum(item.costPerUnit as never),
  };
}

export async function listStock() {
  const items = await prisma.stockItem.findMany({ orderBy: { name: 'asc' } });
  return items.map(serialize);
}

export async function addOrRestock(data: {
  name: string;
  nameAr?: string;
  qty: number;
  unit: string;
  minQty: number;
  costPerUnit: number;
  category: string;
}) {
  const existing = await prisma.stockItem.findFirst({
    where: { name: { equals: data.name, mode: 'insensitive' } },
  });

  if (existing) {
    const newQty = toNum(existing.qty) + data.qty;
    const updated = await prisma.stockItem.update({
      where: { id: existing.id },
      data: { qty: newQty, ...(data.nameAr !== undefined && { nameAr: data.nameAr }) },
    });
    await prisma.stockAdjustment.create({
      data: {
        stockItemId: existing.id,
        delta: data.qty,
        resultingQty: newQty,
        reason: StockAdjustReason.RESTOCK,
        note: 'Restocked via warehouse form',
      },
    });
    return { item: serialize(updated), restocked: true };
  }

  const created = await prisma.stockItem.create({
    data: {
      name: data.name,
      nameAr: data.nameAr,
      qty: data.qty,
      unit: data.unit,
      minQty: data.minQty,
      costPerUnit: data.costPerUnit,
      category: data.category,
    },
  });
  await prisma.stockAdjustment.create({
    data: {
      stockItemId: created.id,
      delta: data.qty,
      resultingQty: data.qty,
      reason: StockAdjustReason.RESTOCK,
      note: 'Added via warehouse form',
    },
  });
  return { item: serialize(created), restocked: false };
}

export async function updateStockItem(
  id: string,
  data: { name?: string; nameAr?: string; category?: string; unit?: string; minQty?: number; costPerUnit?: number },
) {
  const existing = await prisma.stockItem.findUnique({ where: { id } });
  if (!existing) throw notFound('Stock item not found');
  return serialize(await prisma.stockItem.update({ where: { id }, data }));
}

export async function adjustStock(
  id: string,
  input: { delta?: number; setTo?: number; reason: keyof typeof StockAdjustReason; note?: string },
) {
  // Rapid successive taps of the +/- buttons fire concurrent requests; a plain
  // read-then-write here would lose updates (all reads see the same starting
  // qty). Locking the row for the duration of the transaction serializes them.
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ qty: Prisma.Decimal }[]>`SELECT qty FROM "StockItem" WHERE id = ${id} FOR UPDATE`;
    if (!locked.length) throw notFound('Stock item not found');

    const currentQty = toNum(locked[0].qty);
    const newQty = input.setTo !== undefined ? input.setTo : Math.max(0, currentQty + (input.delta ?? 0));
    if (newQty < 0) throw badRequest('Resulting quantity cannot be negative', 'NEGATIVE_STOCK');

    const updated = await tx.stockItem.update({ where: { id }, data: { qty: newQty } });
    await tx.stockAdjustment.create({
      data: {
        stockItemId: id,
        delta: newQty - currentQty,
        resultingQty: newQty,
        reason: input.reason,
        note: input.note,
      },
    });
    return serialize(updated);
  });
}

export async function deleteStockItem(id: string) {
  const existing = await prisma.stockItem.findUnique({ where: { id } });
  if (!existing) throw notFound('Stock item not found');
  await prisma.stockItem.delete({ where: { id } });
}

// Deducts (qtyDelta>0) or restores (qtyDelta<0) stock for a menu item's recipe,
// scaled by qtyDelta units sold/un-sold. No-ops for items with no recipe rows.
// Runs inside the caller's transaction so it stays atomic with the order-item
// change that triggered it. Allowed to push qty negative on purpose — a sale
// shouldn't be blocked by imprecise inventory; negative/low stock is already
// surfaced via the low-stock warnings elsewhere.
export async function applyStockForMenuItemSale(tx: TxClient, menuItemId: string | null, qtyDelta: number) {
  if (!menuItemId || qtyDelta === 0) return;
  const ingredients = await tx.menuItemIngredient.findMany({ where: { menuItemId } });
  for (const ing of ingredients) {
    const change = toNum(ing.qtyPerUnit) * qtyDelta;
    const updated = await tx.stockItem.update({
      where: { id: ing.stockItemId },
      data: { qty: { decrement: change } },
    });
    await tx.stockAdjustment.create({
      data: {
        stockItemId: ing.stockItemId,
        delta: -change,
        resultingQty: updated.qty,
        reason: StockAdjustReason.SALE,
        note: qtyDelta > 0 ? 'Sold via order' : 'Order line reduced or removed',
      },
    });
  }
}

export async function lowStock() {
  const items = await prisma.stockItem.findMany();
  return items.filter((i) => toNum(i.qty) <= toNum(i.minQty)).map(serialize);
}
