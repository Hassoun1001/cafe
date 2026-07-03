import { Prisma } from '@prisma/client';

type Numeric = Prisma.Decimal | number | string | null | undefined;

export function toNum(value: Numeric): number {
  if (value === null || value === undefined) return 0;
  return typeof value === 'object' ? Number(value.toString()) : Number(value);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
