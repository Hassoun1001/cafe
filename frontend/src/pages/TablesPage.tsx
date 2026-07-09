import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Trash2 } from 'lucide-react';
import * as api from '../api/endpoints';
import { money } from '../lib/format';
import { useToast } from '../lib/toast';
import { apiErrorMessage } from '../lib/api';
import { Button, Card, ConfirmModal, EmptyState, PageHeader, Pill, StatCard, StatGrid } from '../components/ui';
import type { CafeTableDto } from '../types';

export function TablesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const [tab, setTab] = useState<'dining' | 'study'>('dining');
  const [detailTable, setDetailTable] = useState<CafeTableDto | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const tablesQuery = useQuery({ queryKey: ['tables'], queryFn: () => api.getTables(), refetchInterval: 8000 });
  const studyTablesQuery = useQuery({ queryKey: ['tables', 'study'], queryFn: () => api.getTables('study'), refetchInterval: 8000 });
  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: api.getSettings });
  const currency = settingsQuery.data?.currency ?? 'SYP';

  const clearTable = useMutation({
    mutationFn: (orderId: string) => api.clearOrder(orderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tables'] });
      setConfirmClear(false);
      setDetailTable(null);
      toast.show('Table cleared');
    },
    onError: (e) => toast.show(apiErrorMessage(e), 'error'),
  });

  const tables = tab === 'dining' ? (tablesQuery.data ?? []) : (studyTablesQuery.data ?? []);
  const occupied = tables.filter((t) => t.openOrder).length;
  const pendingRevenue = tables.reduce((s, t) => s + (t.openOrder?.total ?? 0), 0);

  function selectTab(next: 'dining' | 'study') {
    setTab(next);
    setDetailTable(null);
  }

  return (
    <div>
      <PageHeader title="Tables" description="Live status of every table in the cafe." />

      <div className="mb-5 flex gap-1.5">
        <Pill active={tab === 'dining'} onClick={() => selectTab('dining')}>
          Dining
        </Pill>
        <Pill active={tab === 'study'} onClick={() => selectTab('study')}>
          Study tables & rooms
        </Pill>
      </div>

      <StatGrid>
        <StatCard label={tab === 'dining' ? 'Total tables' : 'Total resources'} value={tables.length} />
        <StatCard label="Active" value={occupied} tone="var(--color-warning)" />
        <StatCard label="Empty" value={tables.length - occupied} tone="var(--color-success)" />
        <StatCard label="Pending revenue" value={`${Math.round(pendingRevenue / 1000)}K ${currency}`} tone="var(--color-accent-dark)" />
      </StatGrid>

      <Card title={tab === 'dining' ? 'All tables' : 'Study tables & rooms'}>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-3">
          {tables.map((t) => (
            <button
              key={t.id}
              onClick={() => setDetailTable(t)}
              className={
                'rounded-xl border-2 p-3.5 text-center transition-all ' +
                (detailTable?.id === t.id
                  ? 'border-accent bg-accent-light'
                  : t.openOrder
                    ? 'border-warning/30 bg-warning-light hover:border-warning/50'
                    : 'border-border bg-surface hover:border-border-strong')
              }
            >
              <div className="text-lg font-bold text-ink">{t.label ?? `T${t.number}`}</div>
              <div className="mt-1 flex items-center justify-center gap-1.5 text-[11px] font-medium text-muted">
                <span className={'size-1.5 rounded-full ' + (t.openOrder ? 'bg-warning' : 'bg-slate-300')} />
                {t.openOrder ? 'Active' : 'Empty'}
              </div>
              {t.openOrder && <div className="mt-1 text-[13px] font-semibold text-accent-dark">{money(t.openOrder.total, currency)}</div>}
            </button>
          ))}
          {tables.length === 0 && <EmptyState>No resources yet</EmptyState>}
        </div>
      </Card>

      {detailTable && (
        <Card title={`${detailTable.label ?? `Table ${detailTable.number}`} — current order`}>
          {!detailTable.openOrder ? (
            <EmptyState>No active order</EmptyState>
          ) : (
            <>
              {tab === 'study' && (
                <div className="mb-3 text-xs text-muted">
                  This is a drink ordered during a Study booking — pay or clear it here like any other order. The table/room itself stays
                  booked until this is settled.
                </div>
              )}
              <TableDetailBody
                orderId={detailTable.openOrder.id}
                currency={currency}
                onGoToCashier={() => navigate('/pos', { state: { tableId: detailTable.id } })}
                onClear={() => setConfirmClear(true)}
              />
            </>
          )}
        </Card>
      )}

      <ConfirmModal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={() => detailTable?.openOrder && clearTable.mutate(detailTable.openOrder.id)}
        title="Clear table?"
        message={`This will discard the open order for table ${detailTable?.number}.`}
        confirmLabel="Clear table"
        danger
      />
    </div>
  );
}

function TableDetailBody({
  orderId,
  currency,
  onGoToCashier,
  onClear,
}: {
  orderId: string;
  currency: string;
  onGoToCashier: () => void;
  onClear: () => void;
}) {
  const orderQuery = useQuery({ queryKey: ['order', orderId], queryFn: () => api.getOrder(orderId) });
  const order = orderQuery.data;
  if (!order) return null;

  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs font-medium text-muted">
            <th className="py-2 font-medium">Item</th>
            <th className="py-2 font-medium">Qty</th>
            <th className="py-2 font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((i) => (
            <tr key={i.id} className="border-b border-border last:border-b-0">
              <td className="py-2.5 text-ink">{i.name}</td>
              <td className="py-2.5 text-ink">{i.qty}</td>
              <td className="py-2.5 font-medium text-ink">{money(i.lineTotal, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <span className="text-base font-bold text-ink">Total: {money(order.total, currency)}</span>
        <div className="flex gap-2">
          <Button variant="primary" onClick={onGoToCashier}>
            Go to cashier
            <ArrowRight className="size-4" />
          </Button>
          <Button variant="danger" onClick={onClear}>
            <Trash2 className="size-4" />
            Clear table
          </Button>
        </div>
      </div>
    </div>
  );
}
