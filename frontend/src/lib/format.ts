// usdRate is SYP per 1 USD (from Settings) — when provided and > 0, appends
// a "(≈ $X.XX)" USD-equivalent alongside the amount. Purely a display
// extra; prices are always entered/stored/charged in the real `currency`.
export function money(n: number, currency = 'SYP', usdRate?: number | null): string {
  const base = `${Math.round(n).toLocaleString('en-US')} ${currency}`;
  if (!usdRate) return base;
  return `${base} (≈ $${(n / usdRate).toFixed(2)})`;
}

export function formatDateTime(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatDate(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleDateString('en-GB');
}
