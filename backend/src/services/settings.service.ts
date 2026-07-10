import { prisma } from '../lib/prisma';
import { toNum } from '../lib/decimal';
import { getAppConfig } from './config.service';
import { notFound } from '../lib/errors';

export async function getSettings() {
  const cfg = await getAppConfig();
  return {
    receiptName: cfg.receiptName,
    receiptFooter: cfg.receiptFooter,
    currency: cfg.currency,
    usdExchangeRate: toNum(cfg.usdExchangeRate),
  };
}

export async function updateSettings(data: { receiptName?: string; receiptFooter?: string; currency?: string; usdExchangeRate?: number }) {
  const cfg = await getAppConfig();
  await prisma.appConfig.update({ where: { id: cfg.id }, data });
  return getSettings();
}

// SYP per 1 USD, or null if not configured (0 = disabled). Shared with the
// PDF generators (receipt + report tables) and the Study system's own
// config response, so there's one authoritative rate for the whole app.
export async function getUsdExchangeRate(): Promise<number | null> {
  const cfg = await getAppConfig();
  const rate = toNum(cfg.usdExchangeRate);
  return rate > 0 ? rate : null;
}

function serializeTaxRate(tax: {
  id: string;
  name: string;
  percent: unknown;
  compound: boolean;
  defaultOn: boolean;
  active: boolean;
  sortOrder: number;
}) {
  return {
    id: tax.id,
    name: tax.name,
    percent: toNum(tax.percent as never),
    compound: tax.compound,
    defaultOn: tax.defaultOn,
    active: tax.active,
    sortOrder: tax.sortOrder,
  };
}

export async function listTaxRates() {
  const rates = await prisma.taxRate.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } });
  return rates.map(serializeTaxRate);
}

export async function createTaxRate(data: { name: string; percent: number; compound?: boolean; defaultOn?: boolean }) {
  const count = await prisma.taxRate.count();
  return serializeTaxRate(await prisma.taxRate.create({ data: { ...data, sortOrder: count } }));
}

export async function updateTaxRate(
  id: string,
  data: { name?: string; percent?: number; compound?: boolean; defaultOn?: boolean; active?: boolean },
) {
  const existing = await prisma.taxRate.findUnique({ where: { id } });
  if (!existing) throw notFound('Tax rate not found');
  return serializeTaxRate(await prisma.taxRate.update({ where: { id }, data }));
}

export async function deleteTaxRate(id: string) {
  const existing = await prisma.taxRate.findUnique({ where: { id } });
  if (!existing) throw notFound('Tax rate not found');
  await prisma.taxRate.delete({ where: { id } });
}

function serializePreset(preset: { id: string; name: string; percent: unknown; active: boolean }) {
  return { id: preset.id, name: preset.name, percent: toNum(preset.percent as never), active: preset.active };
}

export async function listDiscountPresets() {
  const presets = await prisma.discountPreset.findMany({ where: { active: true }, orderBy: { percent: 'asc' } });
  return presets.map(serializePreset);
}

export async function createDiscountPreset(data: { name: string; percent: number }) {
  return serializePreset(await prisma.discountPreset.create({ data }));
}

export async function updateDiscountPreset(
  id: string,
  data: { name?: string; percent?: number; active?: boolean },
) {
  const existing = await prisma.discountPreset.findUnique({ where: { id } });
  if (!existing) throw notFound('Discount preset not found');
  return serializePreset(await prisma.discountPreset.update({ where: { id }, data }));
}

export async function deleteDiscountPreset(id: string) {
  const existing = await prisma.discountPreset.findUnique({ where: { id } });
  if (!existing) throw notFound('Discount preset not found');
  await prisma.discountPreset.delete({ where: { id } });
}

export async function listStockCategories() {
  return prisma.stockCategory.findMany({ orderBy: { sortOrder: 'asc' } });
}

export async function createStockCategory(name: string) {
  const count = await prisma.stockCategory.count();
  return prisma.stockCategory.create({ data: { name, sortOrder: count } });
}

export async function deleteStockCategory(id: string) {
  const existing = await prisma.stockCategory.findUnique({ where: { id } });
  if (!existing) throw notFound('Stock category not found');
  await prisma.stockCategory.delete({ where: { id } });
}

export async function listStockUnits() {
  return prisma.stockUnit.findMany({ orderBy: { sortOrder: 'asc' } });
}

export async function createStockUnit(name: string) {
  const count = await prisma.stockUnit.count();
  return prisma.stockUnit.create({ data: { name, sortOrder: count } });
}

export async function deleteStockUnit(id: string) {
  const existing = await prisma.stockUnit.findUnique({ where: { id } });
  if (!existing) throw notFound('Stock unit not found');
  await prisma.stockUnit.delete({ where: { id } });
}

export async function clearSales() {
  await prisma.order.deleteMany({ where: { status: 'PAID' } });
}

export async function clearEmployeeLog() {
  await prisma.employeeConsumption.deleteMany({});
}

export async function resetAll() {
  await prisma.$transaction([
    prisma.order.deleteMany({}),
    prisma.employeeConsumption.deleteMany({}),
    prisma.stockCount.deleteMany({}),
    prisma.stockAdjustment.deleteMany({}),
  ]);
  await prisma.stockItem.updateMany({ data: { qty: 0 } });
}
