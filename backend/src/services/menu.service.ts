import { prisma } from '../lib/prisma';
import { toNum } from '../lib/decimal';
import { notFound } from '../lib/errors';

export async function getMenu() {
  const categories = await prisma.menuCategory.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  });
  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    sortOrder: c.sortOrder,
    items: c.items.map((i) => ({
      id: i.id,
      name: i.name,
      nameAr: i.nameAr,
      sub: i.sub,
      price: toNum(i.price),
      active: i.active,
      sortOrder: i.sortOrder,
      categoryId: i.categoryId,
    })),
  }));
}

export async function createCategory(data: { name: string; sortOrder?: number }) {
  return prisma.menuCategory.create({ data });
}

export async function updateCategory(id: string, data: { name?: string; sortOrder?: number }) {
  const existing = await prisma.menuCategory.findUnique({ where: { id } });
  if (!existing) throw notFound('Category not found');
  return prisma.menuCategory.update({ where: { id }, data });
}

export async function deleteCategory(id: string) {
  const existing = await prisma.menuCategory.findUnique({ where: { id }, include: { items: true } });
  if (!existing) throw notFound('Category not found');
  await prisma.menuItem.deleteMany({ where: { categoryId: id } });
  await prisma.menuCategory.delete({ where: { id } });
}

function serializeItem(item: {
  id: string;
  name: string;
  nameAr: string | null;
  sub: string;
  price: unknown;
  active: boolean;
  sortOrder: number;
  categoryId: string;
}) {
  return {
    id: item.id,
    name: item.name,
    nameAr: item.nameAr,
    sub: item.sub,
    price: toNum(item.price as never),
    active: item.active,
    sortOrder: item.sortOrder,
    categoryId: item.categoryId,
  };
}

export async function createItem(data: {
  name: string;
  nameAr?: string;
  sub?: string;
  price?: number;
  categoryId: string;
  sortOrder?: number;
}) {
  const category = await prisma.menuCategory.findUnique({ where: { id: data.categoryId } });
  if (!category) throw notFound('Category not found');
  return serializeItem(await prisma.menuItem.create({ data }));
}

export async function updateItem(
  id: string,
  data: { name?: string; nameAr?: string; sub?: string; price?: number; categoryId?: string; active?: boolean; sortOrder?: number },
) {
  const existing = await prisma.menuItem.findUnique({ where: { id } });
  if (!existing) throw notFound('Menu item not found');
  return serializeItem(await prisma.menuItem.update({ where: { id }, data }));
}

export async function deleteItem(id: string) {
  const existing = await prisma.menuItem.findUnique({ where: { id } });
  if (!existing) throw notFound('Menu item not found');
  await prisma.menuItem.delete({ where: { id } });
}

// Bulk save from the Settings price editor — each row can update name, price,
// and/or the Arabic name in one batch.
export async function bulkSaveItems(edits: { id: string; name?: string; price?: number; nameAr?: string }[]) {
  await prisma.$transaction(
    edits.map((e) =>
      prisma.menuItem.update({
        where: { id: e.id },
        data: {
          ...(e.name !== undefined && { name: e.name }),
          ...(e.price !== undefined && { price: e.price }),
          ...(e.nameAr !== undefined && { nameAr: e.nameAr }),
        },
      }),
    ),
  );
}

function serializeIngredient(ing: { id: string; stockItemId: string; qtyPerUnit: unknown; stockItem: { name: string; unit: string } }) {
  return {
    id: ing.id,
    stockItemId: ing.stockItemId,
    stockItemName: ing.stockItem.name,
    unit: ing.stockItem.unit,
    qtyPerUnit: toNum(ing.qtyPerUnit as never),
  };
}

export async function getRecipe(menuItemId: string) {
  const menuItem = await prisma.menuItem.findUnique({ where: { id: menuItemId } });
  if (!menuItem) throw notFound('Menu item not found');
  const ingredients = await prisma.menuItemIngredient.findMany({
    where: { menuItemId },
    include: { stockItem: { select: { name: true, unit: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return ingredients.map(serializeIngredient);
}

// Upsert: setting a qtyPerUnit for a stock item that's already on the recipe
// just updates the amount, backed by @@unique([menuItemId, stockItemId]).
export async function setRecipeIngredient(menuItemId: string, stockItemId: string, qtyPerUnit: number) {
  const menuItem = await prisma.menuItem.findUnique({ where: { id: menuItemId } });
  if (!menuItem) throw notFound('Menu item not found');
  const stockItem = await prisma.stockItem.findUnique({ where: { id: stockItemId } });
  if (!stockItem) throw notFound('Stock item not found');

  await prisma.menuItemIngredient.upsert({
    where: { menuItemId_stockItemId: { menuItemId, stockItemId } },
    create: { menuItemId, stockItemId, qtyPerUnit },
    update: { qtyPerUnit },
  });
  return getRecipe(menuItemId);
}

export async function removeRecipeIngredient(menuItemId: string, stockItemId: string) {
  await prisma.menuItemIngredient.deleteMany({ where: { menuItemId, stockItemId } });
  return getRecipe(menuItemId);
}
