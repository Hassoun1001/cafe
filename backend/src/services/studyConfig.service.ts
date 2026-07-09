import { prisma } from '../lib/prisma';
import { toNum } from '../lib/decimal';

// Singleton row, same pattern as AppConfig — separate hourly rates for
// tables and rooms, independent of any linked Cafe drink order.
export async function getStudyConfig() {
  const cfg = await prisma.studyConfig.findFirst();
  if (!cfg) {
    throw new Error('StudyConfig is missing — run the seed script (npm run db:seed).');
  }
  return { id: cfg.id, tableHourlyRate: toNum(cfg.tableHourlyRate), roomHourlyRate: toNum(cfg.roomHourlyRate), currency: cfg.currency };
}

export async function updateStudyConfig(data: { tableHourlyRate?: number; roomHourlyRate?: number; currency?: string }) {
  const cfg = await prisma.studyConfig.findFirst();
  if (!cfg) throw new Error('StudyConfig is missing — run the seed script (npm run db:seed).');
  await prisma.studyConfig.update({ where: { id: cfg.id }, data });
  return getStudyConfig();
}
