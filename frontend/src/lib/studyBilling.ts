import type { TableKind } from '../types';

// Mirrors backend/src/services/study.service.ts computeBilling exactly, so
// the live figure shown on the Board matches what checkout will actually
// charge. A STUDY_TABLE gets 90 free minutes per drink ordered (stacking);
// a STUDY_ROOM always bills its full elapsed time.
const FREE_MINUTES_PER_DRINK = 90;

export function computeLiveBilling(kind: TableKind, startTime: string, now: number, hourlyRate: number, drinkCount: number) {
  const elapsedMinutes = Math.max(0, (now - new Date(startTime).getTime()) / 60000);
  const freeMinutes = kind === 'STUDY_TABLE' ? drinkCount * FREE_MINUTES_PER_DRINK : 0;
  const billableMinutes = Math.max(0, elapsedMinutes - freeMinutes);
  const hours = billableMinutes / 60;
  const fee = Math.round(hours * hourlyRate * 100) / 100;
  return { elapsedMinutes, freeMinutes, billableMinutes, hours, fee };
}

export function formatMinutes(totalMinutes: number) {
  const m = Math.floor(totalMinutes);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}
