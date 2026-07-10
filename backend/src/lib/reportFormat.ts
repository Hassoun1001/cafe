import type { Response } from 'express';

// usdRate is SYP per 1 USD (from Settings) — when provided and > 0, appends
// a "(~ $X.XX)" USD-equivalent alongside the amount. Purely a display
// extra; the amount itself is always the real stored/charged currency.
// Plain ASCII "~" rather than "≈" — pdfkit's default font encoding doesn't
// reliably survive that Unicode character in these report PDFs.
export function money(n: number, currency: string, usdRate?: number | null): string {
  const base = `${Math.round(n).toLocaleString('en-US')} ${currency}`;
  if (!usdRate) return base;
  return `${base} (~ $${(n / usdRate).toFixed(2)})`;
}

export function formatDateTime(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function streamPdf(res: Response, doc: PDFKit.PDFDocument, filename: string) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  doc.pipe(res);
  doc.end();
}
