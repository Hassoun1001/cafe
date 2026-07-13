import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import * as api from '../api/endpoints';
import { useToast } from '../lib/toast';
import { apiErrorMessage } from '../lib/api';
import { money } from '../lib/format';
import { Button, Input, Label, Modal, Select } from './ui';
import { SearchableSelect } from './SearchableSelect';

interface Row {
  menuItemId: string | null;
  name: string;
  price: string;
  qty: string;
}

const emptyRow: Row = { menuItemId: null, name: '', price: '', qty: '1' };

function nowLocalDateTime(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

// Backdates a sale that actually closed at some point in the past (e.g. a
// bill from before this system was in use, or one closed in a parallel
// legacy system) — same math as a live POS sale (recomputeTotals on the
// backend), just entered by hand with a chosen date/time instead of "now".
export function ManualSaleModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();

  const tablesQuery = useQuery({ queryKey: ['tables'], queryFn: () => api.getTables(), enabled: open });
  const menuQuery = useQuery({ queryKey: ['menu'], queryFn: api.getMenu, enabled: open });
  const taxRatesQuery = useQuery({ queryKey: ['tax-rates'], queryFn: api.getTaxRates, enabled: open });
  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: api.getSettings, enabled: open });
  const currency = settingsQuery.data?.currency ?? 'SYP';
  const usdRate = settingsQuery.data?.usdExchangeRate;

  const [tableId, setTableId] = useState('');
  const [rows, setRows] = useState<Row[]>([{ ...emptyRow }]);
  const [discountPercent, setDiscountPercent] = useState('0');
  const [taxIds, setTaxIds] = useState<string[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD'>('CASH');
  const [cashReceived, setCashReceived] = useState('');
  const [closedAt, setClosedAt] = useState(nowLocalDateTime());

  const menuItems = useMemo(() => (menuQuery.data ?? []).flatMap((c) => c.items.map((i) => ({ ...i, categoryName: c.name }))), [menuQuery.data]);
  const dineTables = (tablesQuery.data ?? []).filter((t) => t.kind === 'DINING');
  const taxRates = taxRatesQuery.data ?? [];

  function resetForm() {
    setTableId('');
    setRows([{ ...emptyRow }]);
    setDiscountPercent('0');
    setTaxIds([]);
    setPaymentMethod('CASH');
    setCashReceived('');
    setClosedAt(nowLocalDateTime());
  }

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function pickMenuItem(i: number, menuItemId: string) {
    const item = menuItems.find((m) => m.id === menuItemId);
    if (!item) return;
    updateRow(i, { menuItemId: item.id, name: item.name, price: String(item.price) });
  }

  // Client-side preview only — the backend independently recomputes the real
  // totals the same way (recomputeTotals), this just lets the user see the
  // numbers before submitting.
  const preview = useMemo(() => {
    const subtotal = rows.reduce((s, r) => s + (parseFloat(r.price) || 0) * (parseInt(r.qty, 10) || 0), 0);
    const discAmt = subtotal * ((parseFloat(discountPercent) || 0) / 100);
    const afterDiscount = subtotal - discAmt;
    let previousTaxAmount: number | null = null;
    let taxTotal = 0;
    for (const rate of taxRates.filter((t) => taxIds.includes(t.id))) {
      const base: number = rate.compound && previousTaxAmount !== null ? previousTaxAmount : afterDiscount;
      const amount: number = base * (rate.percent / 100);
      taxTotal += amount;
      previousTaxAmount = amount;
    }
    return { subtotal, discAmt, taxTotal, total: afterDiscount + taxTotal };
  }, [rows, discountPercent, taxIds, taxRates]);

  const createMutation = useMutation({
    mutationFn: () =>
      api.createManualOrder({
        tableId,
        items: rows
          .filter((r) => r.name.trim() && (parseFloat(r.price) || 0) >= 0 && (parseInt(r.qty, 10) || 0) > 0)
          .map((r) => ({
            menuItemId: r.menuItemId ?? undefined,
            name: r.name.trim(),
            price: parseFloat(r.price) || 0,
            qty: parseInt(r.qty, 10) || 1,
          })),
        discountPercent: parseFloat(discountPercent) || 0,
        taxRateIds: taxIds,
        paymentMethod,
        cashReceived: paymentMethod === 'CASH' ? parseFloat(cashReceived) || 0 : undefined,
        closedAt: new Date(closedAt).toISOString(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders', 'history'] });
      qc.invalidateQueries({ queryKey: ['reports', 'summary'] });
      toast.show('Historical sale added', 'success');
      resetForm();
      onClose();
    },
    onError: (e) => toast.show(apiErrorMessage(e), 'error'),
  });

  function handleSubmit() {
    if (!tableId) {
      toast.show('Pick a table');
      return;
    }
    const validRows = rows.filter((r) => r.name.trim() && (parseFloat(r.price) || 0) >= 0 && (parseInt(r.qty, 10) || 0) > 0);
    if (validRows.length === 0) {
      toast.show('Add at least one item with a name, price, and quantity');
      return;
    }
    if (!closedAt) {
      toast.show('Pick the date/time the sale actually closed');
      return;
    }
    if (paymentMethod === 'CASH' && (parseFloat(cashReceived) || 0) < preview.total) {
      toast.show('Cash received is less than the total due');
      return;
    }
    createMutation.mutate();
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        resetForm();
        onClose();
      }}
      title="Add historical sale"
      maxWidth="640px"
    >
      <p className="mb-4 text-sm text-muted">
        Record a sale that already happened — e.g. a bill closed yesterday, or in a different system — backdated to
        when it actually closed.
      </p>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <Label>Table</Label>
          <Select value={tableId} onChange={(e) => setTableId(e.target.value)}>
            <option value="">Select…</option>
            {dineTables.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label ?? `Table ${t.number}`}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Date & time closed</Label>
          <Input type="datetime-local" value={closedAt} onChange={(e) => setClosedAt(e.target.value)} />
        </div>
      </div>

      <Label>Items</Label>
      <div className="mb-3 space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex items-end gap-2">
            <div className="min-w-0 flex-[2]">
              <SearchableSelect
                items={menuItems.map((m) => ({ id: m.id, label: m.name, sublabel: m.nameAr }))}
                value={row.menuItemId}
                onChange={(id) => pickMenuItem(i, id)}
                placeholder="Search menu or type custom name below"
              />
              <Input
                className="mt-1.5"
                value={row.name}
                onChange={(e) => updateRow(i, { name: e.target.value, menuItemId: null })}
                placeholder="Item name"
              />
            </div>
            <div className="w-24">
              <Input type="number" min={0} step="any" value={row.price} onChange={(e) => updateRow(i, { price: e.target.value })} placeholder="Price" />
            </div>
            <div className="w-16">
              <Input type="number" min={1} step={1} value={row.qty} onChange={(e) => updateRow(i, { qty: e.target.value })} placeholder="Qty" />
            </div>
            <Button
              size="sm"
              variant="danger"
              onClick={() => setRows((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev))}
            >
              <X className="size-3.5" />
            </Button>
          </div>
        ))}
      </div>
      <Button size="sm" variant="secondary" onClick={() => setRows((prev) => [...prev, { ...emptyRow }])}>
        <Plus className="size-3.5" />
        Add item row
      </Button>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <Label>Discount %</Label>
          <Input type="number" min={0} max={100} step="any" value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} />
        </div>
        <div>
          <Label>Payment method</Label>
          <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as 'CASH' | 'CARD')}>
            <option value="CASH">Cash</option>
            <option value="CARD">Card</option>
          </Select>
        </div>
      </div>

      {taxRates.length > 0 && (
        <div className="mt-4">
          <Label>Taxes applied</Label>
          <div className="flex flex-wrap gap-2">
            {taxRates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTaxIds((prev) => (prev.includes(t.id) ? prev.filter((id) => id !== t.id) : [...prev, t.id]))}
                className={
                  'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ' +
                  (taxIds.includes(t.id) ? 'border-accent bg-accent-light text-accent-dark' : 'border-border text-muted hover:bg-bg')
                }
              >
                {t.name} ({t.percent}%){t.compound ? ' · on tax' : ''}
              </button>
            ))}
          </div>
        </div>
      )}

      {paymentMethod === 'CASH' && (
        <div className="mt-4">
          <Label>Cash received</Label>
          <Input type="number" min={0} step="any" value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} />
        </div>
      )}

      <div className="mt-5 rounded-xl border border-border bg-bg p-4 text-sm">
        <div className="flex justify-between py-1 text-muted">
          <span>Subtotal</span>
          <span>{money(preview.subtotal, currency, usdRate)}</span>
        </div>
        {preview.discAmt > 0 && (
          <div className="flex justify-between py-1 text-muted">
            <span>Discount</span>
            <span>-{money(preview.discAmt, currency, usdRate)}</span>
          </div>
        )}
        {preview.taxTotal > 0 && (
          <div className="flex justify-between py-1 text-muted">
            <span>Tax</span>
            <span>{money(preview.taxTotal, currency, usdRate)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-border pt-2 text-base font-bold text-ink">
          <span>Total</span>
          <span>{money(preview.total, currency, usdRate)}</span>
        </div>
      </div>

      <Button variant="primary" className="mt-5 w-full" disabled={createMutation.isPending} onClick={handleSubmit}>
        {createMutation.isPending ? 'Saving…' : 'Add historical sale'}
      </Button>
    </Modal>
  );
}
