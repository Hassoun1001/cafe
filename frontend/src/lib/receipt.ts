import { api } from './api';
import { receiptPdfUrl } from '../api/endpoints';

// PDFs are behind bearer-token auth, so a plain <a href> or window.open won't
// carry the Authorization header — fetch as a blob and open that instead.
async function openPdfBlob(path: string, params?: Record<string, string | undefined>): Promise<void> {
  const res = await api.get(path, { responseType: 'blob', params });
  const blobUrl = URL.createObjectURL(res.data as Blob);
  window.open(blobUrl, '_blank');
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

export async function openReceiptPdf(orderId: string): Promise<void> {
  await openPdfBlob(receiptPdfUrl(orderId));
}

export async function openSalesReportPdf(from?: string, to?: string): Promise<void> {
  await openPdfBlob('/reports/sales.pdf', { from, to });
}

export async function openStockReportPdf(): Promise<void> {
  await openPdfBlob('/reports/stock.pdf');
}

export async function openEmployeesReportPdf(from?: string, to?: string): Promise<void> {
  await openPdfBlob('/reports/employees.pdf', { from, to });
}

export async function openItemSalesReportPdf(from?: string, to?: string, item?: string): Promise<void> {
  await openPdfBlob('/reports/items.pdf', { from, to, item });
}

export async function openTrackerHistoryPdf(): Promise<void> {
  await openPdfBlob('/tracker/history.pdf');
}
