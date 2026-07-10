import { prisma } from '../lib/prisma';
import { toNum } from '../lib/decimal';
import { getUsdExchangeRate } from './settings.service';

// Singleton row, same pattern as AppConfig — separate hourly rates for
// tables and rooms, independent of any linked Cafe drink order.
export async function getStudyConfig() {
  const cfg = await prisma.studyConfig.findFirst();
  if (!cfg) {
    throw new Error('StudyConfig is missing — run the seed script (npm run db:seed).');
  }
  // The USD rate is Cafe-owned (Settings), not editable here — Study just
  // displays it read-only via its own config response since a Study
  // account can't reach /api/settings (different auth realm).
  const usdExchangeRate = await getUsdExchangeRate();
  return {
    id: cfg.id,
    tableHourlyRate: toNum(cfg.tableHourlyRate),
    roomHourlyRate: toNum(cfg.roomHourlyRate),
    currency: cfg.currency,
    usdExchangeRate,
  };
}

export async function updateStudyConfig(data: { tableHourlyRate?: number; roomHourlyRate?: number; currency?: string }) {
  const cfg = await prisma.studyConfig.findFirst();
  if (!cfg) throw new Error('StudyConfig is missing — run the seed script (npm run db:seed).');
  await prisma.studyConfig.update({ where: { id: cfg.id }, data });
  return getStudyConfig();
}
