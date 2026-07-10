import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CheckCircle2, ChevronLeft, ChevronRight, Download, FileText, Printer, X } from 'lucide-react';
import * as api from '../api/endpoints';
import { useToast } from '../lib/toast';
import { apiErrorMessage } from '../lib/api';
import { exportToExcel, todayFileStamp } from '../lib/excel';
import { formatDateTime, money } from '../lib/format';
import { openEmployeesReportPdf, openReceiptPdf, openSalesReportPdf, openStockReportPdf } from '../lib/receipt';
import { Button, Badge, Card, ConfirmModal, Input, Label, PageHeader, Pill, StatCard, StatGrid } from '../components/ui';
import type { ReportGroupBy } from '../types';

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const QUICK_RANGES: { label: string; range: () => { from: string; to: string } }[] = [
  { label: 'Today', range: () => ({ from: toDateStr(new Date()), to: toDateStr(new Date()) }) },
  {
    label: 'Yesterday',
    range: () => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return { from: toDateStr(d), to: toDateStr(d) };
    },
  },
  {
    label: 'This week',
    range: () => {
      const now = new Date();
      const isoDay = (now.getDay() + 6) % 7; // 0 = Monday
      const monday = new Date(now);
      monday.setDate(now.getDate() - isoDay);
      return { from: toDateStr(monday), to: toDateStr(now) };
    },
  },
  {
    label: 'This month',
    range: () => {
      const now = new Date();
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: toDateStr(first), to: toDateStr(now) };
    },
  },
];

export function ReportsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [groupBy, setGroupBy] = useState<ReportGroupBy>('day');
  const [activeQuickRange, setActiveQuickRange] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [deleteOrderId, setDeleteOrderId] = useState<string | null>(null);

  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: api.getSettings });
  const currency = settingsQuery.data?.currency ?? 'SYP';
  const usdRate = settingsQuery.data?.usdExchangeRate;

  const summaryQuery = useQuery({
    queryKey: ['reports', 'summary', from, to, groupBy],
    queryFn: () => api.getReportsSummary(from || undefined, to || undefined, groupBy),
  });

  const historyQuery = useQuery({
    queryKey: ['orders', 'history', from, to, page],
    queryFn: () => api.getSalesHistory({ from: from || undefined, to: to || undefined, page, pageSize: 25 }),
  });

  const voidSale = useMutation({
    mutationFn: (id: string) => api.clearOrder(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders', 'history'] });
      qc.invalidateQueries({ queryKey: ['reports', 'summary'] });
      setDeleteOrderId(null);
      toast.show('Deleted');
    },
    onError: (e) => toast.show(apiErrorMessage(e), 'error'),
  });

  const summary = summaryQuery.data;
  const orders = historyQuery.data?.orders ?? [];
  const totalPages = historyQuery.data ? Math.max(1, Math.ceil(historyQuery.data.total / historyQuery.data.pageSize)) : 1;

  const chartData = useMemo(
    () => (summary?.trend ?? []).map((d) => ({ ...d, label: groupBy === 'month' ? d.date : d.date.slice(5) })),
    [summary, groupBy],
  );

  function applyQuickRange(label: string, range: { from: string; to: string }) {
    setActiveQuickRange(label);
    setFrom(range.from);
    setTo(range.to);
    setPage(1);
  }

  function handleFromToChange(field: 'from' | 'to', value: string) {
    setActiveQuickRange(null);
    if (field === 'from') setFrom(value);
    else setTo(value);
    setPage(1);
  }

  // Exports fetch the FULL matching result set for the selected date range,
  // not just the current 25-row page shown on screen.
  async function fetchAllMatchingSales() {
    const res = await api.getSalesHistory({ from: from || undefined, to: to || undefined, page: 1, pageSize: 5000 });
    return res.orders;
  }

  async function handleExportSales() {
    const allOrders = await fetchAllMatchingSales();
    if (!allOrders.length) {
      toast.show('No sales');
      return;
    }
    const rows: (string | number)[][] = [['Order#', 'Table', 'Date', 'Items', 'Payment', `Tax (${currency})`, `Total (${currency})`]];
    allOrders.forEach((o) =>
      rows.push([
        o.orderNumber,
        `Table ${o.table.number}`,
        formatDateTime(o.closedAt ?? o.openedAt),
        o.items.map((i) => `${i.qty}x ${i.name}`).join(', '),
        o.paymentMethod ?? '',
        o.taxAmount,
        o.total,
      ]),
    );
    rows.push(['', '', '', '', '', 'TOTAL', allOrders.reduce((s, o) => s + o.total, 0)]);
    exportToExcel(`StudioCafe_Sales_${todayFileStamp()}.xlsx`, 'Sales', rows);
    toast.show('Exported!', 'success');
  }

  function handleExportStock() {
    api.getStock().then((stock) => {
      const rows: (string | number)[][] = [['Item', 'Category', 'Qty', 'Unit', 'Min', 'Cost/unit', 'Total Value', 'Status']];
      stock.forEach((s) => rows.push([s.name, s.category, s.qty, s.unit, s.minQty, s.costPerUnit, s.qty * s.costPerUnit, s.qty <= s.minQty ? 'LOW' : 'OK']));
      exportToExcel(`StudioCafe_Stock_${todayFileStamp()}.xlsx`, 'Stock', rows);
      toast.show('Exported!', 'success');
    });
  }

  function handleExportEmployees() {
    api.getConsumption().then((res) => {
      if (!res.logs.length) {
        toast.show('No log');
        return;
      }
      const rows: (string | number)[][] = [['Date', 'Employee', 'Item', `Price (${currency})`, 'Type']];
      res.logs.forEach((l) => rows.push([formatDateTime(l.date), l.employee, l.itemName, l.price, l.type === 'FREE' ? 'Free' : 'Deduct']));
      exportToExcel(`StudioCafe_Employees_${todayFileStamp()}.xlsx`, 'Employees', rows);
      toast.show('Exported!', 'success');
    });
  }

  async function handlePdfExport(fn: () => Promise<void>) {
    try {
      await fn();
    } catch (e) {
      toast.show(apiErrorMessage(e), 'error');
    }
  }

  return (
    <div>
      <PageHeader title="Reports" description="Revenue, sales history, and stock health at a glance." />

      <Card title="Export reports">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { label: 'Sales', excel: handleExportSales, pdf: () => handlePdfExport(() => openSalesReportPdf(from || undefined, to || undefined)) },
            { label: 'Stock', excel: handleExportStock, pdf: () => handlePdfExport(() => openStockReportPdf()) },
            { label: 'Employees', excel: handleExportEmployees, pdf: () => handlePdfExport(() => openEmployeesReportPdf(from || undefined, to || undefined)) },
          ].map((group) => (
            <div key={group.label} className="flex items-center justify-between rounded-xl border border-border p-3">
              <span className="text-sm font-medium text-ink">{group.label}</span>
              <div className="flex gap-1.5">
                <Button size="sm" variant="secondary" onClick={group.excel}>
                  <Download className="size-3.5" />
                  Excel
                </Button>
                <Button size="sm" variant="secondary" onClick={group.pdf}>
                  <FileText className="size-3.5" />
                  PDF
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex flex-wrap gap-2">
          {QUICK_RANGES.map((qr) => (
            <Pill key={qr.label} active={activeQuickRange === qr.label} onClick={() => applyQuickRange(qr.label, qr.range())}>
              {qr.label}
            </Pill>
          ))}
          <Pill active={activeQuickRange === null} onClick={() => setActiveQuickRange(null)}>
            Custom
          </Pill>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <Label>From</Label>
            <Input type="date" value={from} onChange={(e) => handleFromToChange('from', e.target.value)} />
          </div>
          <div>
            <Label>To</Label>
            <Input type="date" value={to} onChange={(e) => handleFromToChange('to', e.target.value)} />
          </div>
        </div>
      </Card>

      <StatGrid>
        <StatCard
          label="Revenue"
          value={`${Math.round((summary?.revenue ?? 0) / 1000)}K${usdRate ? ` (≈ $${((summary?.revenue ?? 0) / usdRate).toFixed(0)})` : ''}`}
          tone="var(--color-accent-dark)"
        />
        <StatCard label="Orders" value={summary?.orderCount ?? 0} />
        <StatCard label="Avg order" value={money(summary?.avgOrder ?? 0, currency, usdRate)} />
        <StatCard label="Tax collected" value={money(summary?.taxCollected ?? 0, currency, usdRate)} tone="var(--color-warning)" />
        <StatCard label="Employee cost" value={money(summary?.employeeCost ?? 0, currency, usdRate)} tone="var(--color-danger)" />
      </StatGrid>

      <Card
        title="Revenue trend"
        action={
          <div className="flex gap-1.5">
            {(['day', 'week', 'month'] as const).map((g) => (
              <Pill key={g} active={groupBy === g} onClick={() => setGroupBy(g)}>
                {g === 'day' ? 'Daily' : g === 'week' ? 'Weekly' : 'Monthly'}
              </Pill>
            ))}
          </div>
        }
      >
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="label" fontSize={12} stroke="#94a3b8" axisLine={false} tickLine={false} />
              <YAxis fontSize={12} stroke="#94a3b8" axisLine={false} tickLine={false} width={40} />
              <Tooltip
                formatter={(v) => money(Number(v), currency, usdRate)}
                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }}
              />
              <Area type="monotone" dataKey="total" stroke="#0d9488" fill="url(#revenueGradient)" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Top selling items">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium text-muted">
                <th className="py-2.5 pr-3">Item</th>
                <th className="py-2.5 pr-3">Qty</th>
                <th className="py-2.5">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {(summary?.topItems ?? []).map((i) => (
                <tr key={i.name} className="border-b border-border last:border-b-0">
                  <td className="py-2.5 pr-3 font-medium text-ink">{i.name}</td>
                  <td className="py-2.5 pr-3 text-muted">{i.qty}</td>
                  <td className="py-2.5 text-ink">{money(i.revenue, currency, usdRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Payment split & low stock">
          <div className="mb-4 flex gap-3">
            <div className="flex-1 rounded-xl bg-success-light p-4 text-center">
              <div className="text-xs font-medium text-success">Cash</div>
              <div className="mt-1 text-lg font-bold text-success">{money(summary?.paymentSplit.cash ?? 0, currency, usdRate)}</div>
            </div>
            <div className="flex-1 rounded-xl bg-info-light p-4 text-center">
              <div className="text-xs font-medium text-info">Card</div>
              <div className="mt-1 text-lg font-bold text-info">{money(summary?.paymentSplit.card ?? 0, currency, usdRate)}</div>
            </div>
            <div className="flex-1 rounded-xl bg-warning-light p-4 text-center">
              <div className="text-xs font-medium text-warning">Change given</div>
              <div className="mt-1 text-lg font-bold text-warning">{money(summary?.changeGiven ?? 0, currency, usdRate)}</div>
            </div>
          </div>
          {(summary?.lowStock ?? []).length === 0 ? (
            <div className="flex items-center gap-2 rounded-xl bg-success-light px-4 py-3 text-sm font-medium text-success">
              <CheckCircle2 className="size-4" />
              All stock OK
            </div>
          ) : (
            (summary?.lowStock ?? []).map((s) => (
              <div key={s.id} className="flex items-center justify-between border-b border-border py-2.5 last:border-b-0">
                <span className="text-sm font-medium text-ink">{s.name}</span>
                <Badge tone="red">
                  {s.qty} {s.unit} left
                </Badge>
              </div>
            ))
          )}
        </Card>
      </div>

      <Card title="Sales history">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium text-muted">
                <th className="py-2.5 pr-3">Order#</th>
                <th className="py-2.5 pr-3">Table</th>
                <th className="py-2.5 pr-3">Date</th>
                <th className="py-2.5 pr-3">Items</th>
                <th className="py-2.5 pr-3">Payment</th>
                <th className="py-2.5 pr-3">Tax</th>
                <th className="py-2.5 pr-3">Total</th>
                <th className="py-2.5 pr-3">Change given</th>
                <th className="py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-sm text-muted">
                    No sales yet
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="border-b border-border last:border-b-0">
                    <td className="py-2.5 pr-3 font-semibold text-ink">#{o.orderNumber}</td>
                    <td className="py-2.5 pr-3">
                      <Badge tone="blue">T{o.table.number}</Badge>
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-muted">{formatDateTime(o.closedAt ?? o.openedAt)}</td>
                    <td className="max-w-[200px] truncate py-2.5 pr-3 text-xs text-muted">{o.items.map((i) => `${i.qty}x ${i.name}`).join(', ')}</td>
                    <td className="py-2.5 pr-3">
                      <Badge tone={o.paymentMethod === 'CASH' ? 'green' : 'blue'}>{o.paymentMethod}</Badge>
                    </td>
                    <td className="py-2.5 pr-3 text-muted">{o.taxAmount ? money(o.taxAmount, currency, usdRate) : '—'}</td>
                    <td className="py-2.5 pr-3 font-semibold text-ink">{money(o.total, currency, usdRate)}</td>
                    <td className="py-2.5 pr-3 text-warning">{o.changeGiven ? money(o.changeGiven, currency, usdRate) : '—'}</td>
                    <td className="py-2.5">
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="secondary" onClick={() => openReceiptPdf(o.id)}>
                          <Printer className="size-3.5" />
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => setDeleteOrderId(o.id)}>
                          <X className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-3">
            <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="size-4" />
              Prev
            </Button>
            <span className="text-xs font-medium text-muted">
              Page {page} of {totalPages}
            </span>
            <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}
      </Card>

      <ConfirmModal
        open={!!deleteOrderId}
        onClose={() => setDeleteOrderId(null)}
        onConfirm={() => deleteOrderId && voidSale.mutate(deleteOrderId)}
        title="Delete sale?"
        message="This will permanently remove the sale from history."
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
