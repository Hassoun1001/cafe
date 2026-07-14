import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Banknote, CreditCard, Minus, Plus, Printer, Receipt, Search, Trash2, X } from 'lucide-react';
import * as api from '../api/endpoints';
import { useToast } from '../lib/toast';
import { money } from '../lib/format';
import { openReceiptPdf } from '../lib/receipt';
import { apiErrorMessage } from '../lib/api';
import { Button, Card, Input, Modal, PageHeader, Pill, EmptyState } from '../components/ui';
import type { MenuItemDto, OrderDto } from '../types';

export function PosPage() {
  const qc = useQueryClient();
  const toast = useToast();

  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [cashModalOpen, setCashModalOpen] = useState(false);
  const [cashReceived, setCashReceived] = useState('');

  const tablesQuery = useQuery({ queryKey: ['tables'], queryFn: () => api.getTables(), refetchInterval: 8000 });
  const menuQuery = useQuery({ queryKey: ['menu'], queryFn: api.getMenu });
  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: api.getSettings });
  const presetsQuery = useQuery({ queryKey: ['discount-presets'], queryFn: api.getDiscountPresets });
  const taxRatesQuery = useQuery({ queryKey: ['tax-rates'], queryFn: api.getTaxRates });
  const orderQuery = useQuery({
    queryKey: ['order', selectedOrderId],
    queryFn: () => api.getOrder(selectedOrderId as string),
    enabled: !!selectedOrderId,
    refetchInterval: 8000,
  });

  const order = orderQuery.data;
  const currency = settingsQuery.data?.currency ?? 'SYP';
  const usdRate = settingsQuery.data?.usdExchangeRate;

  // Selling recipe-linked items deducts stock immediately, so anything that
  // can change order items must also refresh Warehouse/Tracker if they're open.
  function invalidateStockViews() {
    qc.invalidateQueries({ queryKey: ['stock'] });
    qc.invalidateQueries({ queryKey: ['tracker'] });
  }

  function setOrderCache(updated: OrderDto) {
    qc.setQueryData(['order', updated.id], updated);
    qc.invalidateQueries({ queryKey: ['tables'] });
    invalidateStockViews();
  }

  const openTable = useMutation({
    mutationFn: (tableId: string) => api.openOrderForTable(tableId),
    onSuccess: (o) => {
      setSelectedOrderId(o.id);
      setOrderCache(o);
      toast.show(`Table ${o.table.number} selected`, 'info');
    },
    onError: (e) => toast.show(apiErrorMessage(e), 'error'),
  });

  const addItem = useMutation({
    mutationFn: (menuItemId: string) => api.addOrderItem(order!.id, menuItemId),
    onSuccess: setOrderCache,
    onError: (e) => toast.show(apiErrorMessage(e), 'error'),
  });

  const setQty = useMutation({
    mutationFn: (vars: { lineId: string; qty: number }) => api.setLineQty(order!.id, vars.lineId, vars.qty),
    onSuccess: setOrderCache,
    onError: (e) => toast.show(apiErrorMessage(e), 'error'),
  });

  const patchOrder = useMutation({
    mutationFn: (data: { discountPercent?: number }) => api.patchOrder(order!.id, data),
    onSuccess: setOrderCache,
    onError: (e) => toast.show(apiErrorMessage(e), 'error'),
  });

  const toggleTax = useMutation({
    mutationFn: (vars: { taxRateId: string; on: boolean }) =>
      vars.on ? api.addOrderTax(order!.id, vars.taxRateId) : api.removeOrderTax(order!.id, vars.taxRateId),
    onSuccess: setOrderCache,
    onError: (e) => toast.show(apiErrorMessage(e), 'error'),
  });

  const setTaxManualAmount = useMutation({
    mutationFn: (vars: { taxRateId: string; manualAmount: number | null }) =>
      api.setOrderTaxManualAmount(order!.id, vars.taxRateId, vars.manualAmount),
    onSuccess: setOrderCache,
    onError: (e) => toast.show(apiErrorMessage(e), 'error'),
  });

  const clearOrder = useMutation({
    mutationFn: () => api.clearOrder(order!.id),
    onSuccess: () => {
      setSelectedOrderId(null);
      setSelectedTableId(null);
      qc.invalidateQueries({ queryKey: ['tables'] });
      invalidateStockViews();
      toast.show('Order cleared');
    },
    onError: (e) => toast.show(apiErrorMessage(e), 'error'),
  });

  const pay = useMutation({
    mutationFn: (vars: { method: 'CASH' | 'CARD'; cashReceived?: number }) =>
      api.payOrder(order!.id, vars.method, vars.cashReceived),
    onSuccess: (paid) => {
      setCashModalOpen(false);
      setCashReceived('');
      toast.show(`Table ${paid.table.number} paid — ${money(paid.total, currency, usdRate)}`, 'success');
      setSelectedOrderId(null);
      setSelectedTableId(null);
      qc.invalidateQueries({ queryKey: ['tables'] });
    },
    onError: (e) => toast.show(apiErrorMessage(e), 'error'),
  });

  const categories = useMemo(() => ['All', ...(menuQuery.data ?? []).map((c) => c.name)], [menuQuery.data]);
  const visibleItems = useMemo(() => {
    const all = (menuQuery.data ?? []).flatMap((c) => c.items.map((i) => ({ ...i, categoryName: c.name })));
    const q = search.trim().toLowerCase();
    return all.filter((i) => {
      const inCategory = activeCategory === 'All' || i.categoryName === activeCategory;
      const matchesSearch = q === '' || i.name.toLowerCase().includes(q) || (i.nameAr ?? '').toLowerCase().includes(q);
      return inCategory && matchesSearch;
    });
  }, [menuQuery.data, activeCategory, search]);

  function handleSelectTable(tableId: string) {
    setSelectedTableId(tableId);
    openTable.mutate(tableId);
  }

  const location = useLocation();
  useEffect(() => {
    const incomingTableId = (location.state as { tableId?: string } | null)?.tableId;
    if (incomingTableId) {
      handleSelectTable(incomingTableId);
      window.history.replaceState({}, '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  function handleAddToOrder(item: MenuItemDto) {
    if (!order) {
      toast.show('Select a table first!', 'error');
      return;
    }
    addItem.mutate(item.id);
  }

  async function handlePrintReceipt() {
    if (!order || order.items.length === 0) {
      toast.show('Add items first');
      return;
    }
    try {
      await openReceiptPdf(order.id);
    } catch (e) {
      toast.show(apiErrorMessage(e), 'error');
    }
  }

  const cashReceivedNum = parseFloat(cashReceived) || 0;
  const change = order ? cashReceivedNum - order.total : 0;

  return (
    <div>
      <PageHeader title="Cashier" description="Select a table, build the order, then take payment." />
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[1fr_380px]">
        <div>
          <Card title="Select table">
            <div className="flex flex-wrap gap-2">
              {(tablesQuery.data ?? []).map((t) => {
                const isSelected = selectedTableId === t.id;
                const hasOrder = !!t.openOrder;
                return (
                  <button
                    key={t.id}
                    data-testid={`table-${t.number}`}
                    onClick={() => handleSelectTable(t.id)}
                    className={
                      'min-w-[52px] rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ' +
                      (isSelected
                        ? 'border-accent bg-accent text-white'
                        : hasOrder
                          ? 'border-warning/30 bg-warning-light text-warning'
                          : 'border-border bg-surface text-ink hover:border-border-strong hover:bg-bg')
                    }
                  >
                    T{t.number}
                  </button>
                );
              })}
            </div>
          </Card>

          <Card title="Menu">
            <div className="relative mb-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-2" />
              <Input placeholder="Search menu (English or Arabic)…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              {categories.map((c) => (
                <Pill key={c} active={c === activeCategory} onClick={() => setActiveCategory(c)}>
                  {c}
                </Pill>
              ))}
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2.5">
              {visibleItems.map((item) => (
                <button
                  key={item.id}
                  data-testid={`menu-item-${item.name.replace(/\s+/g, '-')}`}
                  onClick={() => handleAddToOrder(item)}
                  className="flex min-h-[92px] flex-col justify-between rounded-xl border border-border bg-surface p-3 text-left transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-[var(--shadow-card)] active:translate-y-0 active:scale-[0.98]"
                >
                  <div>
                    <div className="text-[13px] font-semibold leading-tight text-ink">{item.name}</div>
                    {item.nameAr && (
                      <div dir="rtl" lang="ar" className="mt-0.5 text-[12px] font-medium leading-tight text-muted">
                        {item.nameAr}
                      </div>
                    )}
                    {item.sub && <div className="mt-0.5 text-[11px] leading-snug text-muted-2 line-clamp-2">{item.sub}</div>}
                  </div>
                  {item.price > 0 ? (
                    <div className="mt-2 text-[13px] font-semibold text-accent-dark">{money(item.price, currency, usdRate)}</div>
                  ) : (
                    <div className="mt-2 text-xs italic text-muted-2">price TBD</div>
                  )}
                </button>
              ))}
            </div>
          </Card>
        </div>

        <div className="flex flex-col xl:sticky xl:top-8 xl:max-h-[calc(100vh-2rem)]">
          {order && (
            <div className="mb-4 flex shrink-0 items-center justify-between rounded-2xl bg-ink px-4 py-3.5 text-white">
              <span className="text-sm font-semibold">{order.table.label ?? `Table ${order.table.number}`}</span>
              <button
                onClick={() => {
                  setSelectedOrderId(null);
                  setSelectedTableId(null);
                }}
                className="rounded-lg bg-white/15 px-3 py-1.5 text-xs font-medium hover:bg-white/25"
              >
                Change table
              </button>
            </div>
          )}
          {/* The whole card scrolls as one region on short screens — items,
              discount, tax, total, and payment buttons all included — rather
              than only the item list, so nothing ends up clipped below the
              fold on a small laptop screen. */}
          <Card className="min-h-0 flex-1 overflow-y-auto">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink">
              <Receipt className="size-4 text-muted-2" />
              Current order
              {order && order.items.length > 0 && (
                <span className="ml-auto rounded-full bg-accent-light px-2 py-0.5 text-xs font-semibold text-accent-dark">
                  {order.items.reduce((s, i) => s + i.qty, 0)} items
                </span>
              )}
            </div>
            {!order || order.items.length === 0 ? (
              <EmptyState icon={<Receipt className="size-8" strokeWidth={1.5} />}>
                {order ? 'Tap menu items to add them here' : 'Select a table to start an order'}
              </EmptyState>
            ) : (
              <div>
                {order.items.map((line) => (
                  <div key={line.id} className="flex items-center gap-2 border-b border-border py-2.5 last:border-b-0">
                    <span className="flex-1 text-sm font-medium text-ink">{line.name}</span>
                    <div className="flex items-center gap-1">
                      <button
                        className="flex size-7 items-center justify-center rounded-md border border-border bg-surface text-muted hover:bg-bg"
                        onClick={() => setQty.mutate({ lineId: line.id, qty: line.qty - 1 })}
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <span className="min-w-[22px] text-center text-sm font-bold text-ink">{line.qty}</span>
                      <button
                        className="flex size-7 items-center justify-center rounded-md border border-border bg-surface text-muted hover:bg-bg"
                        onClick={() => setQty.mutate({ lineId: line.id, qty: line.qty + 1 })}
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                    <span className="min-w-[80px] text-right text-[13px] font-semibold text-ink">{money(line.lineTotal, currency, usdRate)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="my-4 border-t border-border" />

            <div className="flex items-center justify-between py-1.5">
              <span className="text-sm text-muted">Subtotal</span>
              <span className="text-sm font-semibold text-ink">{money(order?.subtotal ?? 0, currency, usdRate)}</span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-sm text-muted">Discount %</span>
              <Input
                type="number"
                min={0}
                max={100}
                disabled={!order}
                value={order?.discountPercent ?? 0}
                onChange={(e) => patchOrder.mutate({ discountPercent: parseFloat(e.target.value) || 0 })}
                className="w-[70px] py-1.5 text-center"
              />
            </div>
            {order && (presetsQuery.data ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1.5 pb-2">
                {(presetsQuery.data ?? []).map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => patchOrder.mutate({ discountPercent: preset.percent })}
                    className={
                      'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ' +
                      (order.discountPercent === preset.percent
                        ? 'border-accent bg-accent-light text-accent-dark'
                        : 'border-border text-muted hover:bg-bg')
                    }
                  >
                    {preset.name} ({preset.percent}%)
                  </button>
                ))}
              </div>
            )}
            {(taxRatesQuery.data ?? []).length > 0 && (
              <div className="py-1.5">
                <div className="mb-1.5 text-sm text-muted">Taxes</div>
                <div className="flex flex-wrap gap-1.5">
                  {(taxRatesQuery.data ?? []).map((tax) => {
                    const isOn = !!order?.taxes.some((t) => t.taxRateId === tax.id);
                    return (
                      <button
                        key={tax.id}
                        disabled={!order}
                        onClick={() => toggleTax.mutate({ taxRateId: tax.id, on: !isOn })}
                        className={
                          'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-40 ' +
                          (isOn ? 'border-accent bg-accent-light text-accent-dark' : 'border-border text-muted hover:bg-bg')
                        }
                      >
                        {tax.name} ({tax.percent}%){tax.compound && ' · on tax'}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {order && order.taxes.length > 0 && (
              <div className="mt-1">
                {order.taxes.map((t) => (
                  <div key={t.taxRateId} className="flex items-center justify-between gap-2 py-1">
                    <span className="text-sm text-muted">
                      {t.name} ({t.percent}%){t.compound && <span className="text-muted-2"> · on tax above</span>}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        value={t.amount}
                        onChange={(e) => {
                          if (!t.taxRateId) return;
                          const v = parseFloat(e.target.value);
                          setTaxManualAmount.mutate({ taxRateId: t.taxRateId, manualAmount: Number.isFinite(v) ? v : 0 });
                        }}
                        className="w-[92px] py-1 text-right text-sm font-medium text-warning"
                      />
                      {t.manualAmount !== null && t.taxRateId && (
                        <button
                          type="button"
                          title="Back to auto (% of bill)"
                          onClick={() => setTaxManualAmount.mutate({ taxRateId: t.taxRateId as string, manualAmount: null })}
                          className="text-[11px] font-medium text-accent hover:underline"
                        >
                          Auto
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="my-4 border-t border-border" />
            <div className="flex items-center justify-between py-1">
              <span className="text-base font-bold text-ink">Total</span>
              <span className="text-xl font-bold text-accent-dark">{money(order?.total ?? 0, currency, usdRate)}</span>
            </div>

            <Button variant="dark" size="lg" className="mt-4 mb-2 w-full" onClick={handlePrintReceipt}>
              <Printer className="size-4" />
              Print receipt
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="primary" size="lg" disabled={!order || order.items.length === 0} onClick={() => setCashModalOpen(true)}>
                <Banknote className="size-4" />
                Cash
              </Button>
              <Button
                size="lg"
                className="bg-info text-white hover:bg-blue-700"
                disabled={!order || order.items.length === 0}
                onClick={() => pay.mutate({ method: 'CARD' })}
              >
                <CreditCard className="size-4" />
                Card
              </Button>
            </div>
            <button
              disabled={!order}
              onClick={() => clearOrder.mutate()}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium text-muted hover:bg-bg disabled:opacity-40"
            >
              <Trash2 className="size-3.5" />
              Clear order
            </button>
          </Card>
        </div>
      </div>

      <Modal open={cashModalOpen} onClose={() => setCashModalOpen(false)} title="Cash payment">
        <div className="mb-1 text-xs text-muted">Total due</div>
        <div className="mb-4 text-3xl font-bold text-accent-dark">{money(order?.total ?? 0, currency, usdRate)}</div>
        <div className="mb-1.5 text-xs font-medium text-muted">Cash received ({currency})</div>
        <Input type="number" autoFocus placeholder="Enter amount" value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} className="text-lg" />
        <div className={`my-4 rounded-xl py-3 text-center text-2xl font-bold ${change >= 0 ? 'bg-success-light text-success' : 'bg-danger-light text-danger'}`}>
          {cashReceived === '' ? 'Change: —' : change >= 0 ? `Change: ${money(change, currency, usdRate)}` : `Still need: ${money(-change, currency, usdRate)}`}
        </div>
        <div className="flex gap-2">
          <Button
            variant="primary"
            size="lg"
            className="flex-1"
            disabled={change < 0 || cashReceived === ''}
            onClick={() => pay.mutate({ method: 'CASH', cashReceived: cashReceivedNum })}
          >
            Confirm payment
          </Button>
          <Button variant="secondary" size="lg" onClick={() => setCashModalOpen(false)}>
            <X className="size-4" />
          </Button>
        </div>
      </Modal>
    </div>
  );
}
