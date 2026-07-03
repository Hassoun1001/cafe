import type { Response } from 'express';

export function money(n: number, currency: string): string {
  return `${Math.round(n).toLocaleString('en-US')} ${currency}`;
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
