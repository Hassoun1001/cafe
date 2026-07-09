import * as XLSX from 'xlsx';

export interface LedgerRow {
  entryNumber: number;
  tableNumber: number;
  amount: number;
  date: Date;
}

export interface ParseResult {
  rows: LedgerRow[];
  skipped: { rowIndex: number; reason: string }[];
}

// Parses the "كشف حساب" (account statement) / "صندوق" (cash register) daily
// ledger export from the previous system. Real transaction rows are the only
// ones with a numeric entry number in column 4 (رقم القيد) — this alone
// cleanly distinguishes them from the title row, column-header row, the
// opening-balance row, and the two summary rows at the bottom, none of which
// have an entry number. Columns (0-indexed): 0=amount/debit (مدين),
// 2=description (البيان), 3=table label e.g. "طاولة 01" (الحساب),
// 4=entry number (رقم القيد), 5=date (التاريخ).
export function parseLedgerFile(buffer: Buffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const grid: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });

  const rows: LedgerRow[] = [];
  const skipped: ParseResult['skipped'] = [];

  grid.forEach((row, rowIndex) => {
    const entryNumberRaw = row[4];
    if (typeof entryNumberRaw !== 'number' || !Number.isInteger(entryNumberRaw)) return; // header/summary/opening-balance row

    const amount = Number(row[0]);
    const tableLabel = String(row[3] ?? '');
    const dateRaw = row[5];

    const tableMatch = tableLabel.match(/(\d+)/);
    // SheetJS's `cellDates: true` bakes the *reading machine's* local
    // timezone offset into the resulting Date's UTC value (e.g. a plain
    // "2026-07-06" cell becomes 2026-07-05T20:00:00Z on a UTC+4 machine).
    // The rest of this app treats date-only values as UTC-based (see
    // endOfDayExclusive), so re-derive the calendar date from the Date's
    // *local* getters — which correctly reflect the original wall-clock
    // date — and rebuild it as a clean UTC midnight instead of trusting
    // the Date's own (shifted) UTC representation.
    const rawDate = dateRaw instanceof Date ? dateRaw : typeof dateRaw === 'string' ? new Date(dateRaw) : null;
    const date = rawDate && !Number.isNaN(rawDate.getTime())
      ? new Date(Date.UTC(rawDate.getFullYear(), rawDate.getMonth(), rawDate.getDate()))
      : null;

    if (!tableMatch || Number.isNaN(amount) || amount <= 0 || !date) {
      skipped.push({ rowIndex, reason: `Could not parse row (table="${tableLabel}", amount=${row[0]}, date=${dateRaw})` });
      return;
    }

    rows.push({ entryNumber: entryNumberRaw, tableNumber: Number(tableMatch[1]), amount, date });
  });

  return { rows, skipped };
}
