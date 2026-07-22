import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Plus, X } from 'lucide-react';
import * as api from '../api/endpoints';
import { useToast } from '../lib/toast';
import { apiErrorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { exportToExcel, todayFileStamp } from '../lib/excel';
import { formatDateTime, money } from '../lib/format';
import { Badge, Button, Card, ConfirmModal, Input, Label, PageHeader, Select, StatGrid } from '../components/ui';
import { SearchableSelect } from '../components/SearchableSelect';
import type { ConsumptionType } from '../types';

export function EmployeesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { can } = useAuth();
  const employeesQuery = useQuery({ queryKey: ['employees'], queryFn: api.getEmployees });
  const consumptionQuery = useQuery({ queryKey: ['employees', 'consumption'], queryFn: api.getConsumption });
  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: api.getSettings });
  const menuQuery = useQuery({ queryKey: ['menu'], queryFn: api.getMenu });
  const currency = settingsQuery.data?.currency ?? 'SYP';
  const usdRate = settingsQuery.data?.usdExchangeRate;

  const employees = employeesQuery.data ?? [];
  const menuItems = useMemo(() => (menuQuery.data ?? []).flatMap((c) => c.items), [menuQuery.data]);
  const menuItemOptions = useMemo(() => menuItems.map((i) => ({ id: i.id, label: i.name, sublabel: i.nameAr })), [menuItems]);

  const [employeeId, setEmployeeId] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [price, setPrice] = useState('');
  const [type, setType] = useState<ConsumptionType>('FREE');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const effectiveEmployeeId = employeeId || employees[0]?.id || '';

  function handleSelectItem(id: string) {
    setSelectedItemId(id);
    const item = menuItems.find((m) => m.id === id);
    if (item) setPrice(String(item.price));
  }

  const log = useMutation({
    mutationFn: api.logConsumption,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees', 'consumption'] });
      setSelectedItemId('');
      setPrice('');
      toast.show('Logged!', 'success');
    },
    onError: (e) => toast.show(apiErrorMessage(e), 'error'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteConsumption(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees', 'consumption'] });
      setDeleteId(null);
      toast.show('Deleted');
    },
    onError: (e) => toast.show(apiErrorMessage(e), 'error'),
  });

  function handleLog() {
    const item = menuItems.find((m) => m.id === selectedItemId);
    if (!item) {
      toast.show('Pick an item from the menu');
      return;
    }
    if (!effectiveEmployeeId) {
      toast.show('Add an employee in Settings first', 'error');
      return;
    }
    log.mutate({ employeeId: effectiveEmployeeId, itemName: item.name, price: parseFloat(price) || 0, type });
  }

  function handleExport() {
    const logs = consumptionQuery.data?.logs ?? [];
    if (!logs.length) {
      toast.show('No log');
      return;
    }
    const rows: (string | number)[][] = [['Date', 'Employee', 'Item', `Price (${currency})`, 'Type']];
    logs.forEach((l) => rows.push([formatDateTime(l.date), l.employee, l.itemName, l.price, l.type === 'FREE' ? 'Free' : 'Deduct']));
    exportToExcel(`StudioCafe_Employees_${todayFileStamp()}.xlsx`, 'Employees', rows);
    toast.show('Exported!', 'success');
  }

  const logs = consumptionQuery.data?.logs ?? [];
  const summary = consumptionQuery.data?.summary ?? [];

  return (
    <div>
      <PageHeader title="Employees" description="Log free or deducted staff consumption." />

      <Card title="Log consumption">
        <div className="mb-3 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
          <div>
            <Label>Employee</Label>
            <Select value={effectiveEmployeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                  {e.nameAr ? ` — ${e.nameAr}` : ''}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Item</Label>
            <SearchableSelect
              items={menuItemOptions}
              value={selectedItemId}
              onChange={handleSelectItem}
              placeholder="Search item (English or Arabic)…"
            />
          </div>
          <div>
            <Label>Price ({currency})</Label>
            <Input type="number" placeholder="5000" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
        </div>
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setType('FREE')}
            className={
              'flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ' +
              (type === 'FREE' ? 'border-success/30 bg-success-light text-success' : 'border-border text-muted hover:bg-bg')
            }
          >
            Free
          </button>
          <button
            onClick={() => setType('DEDUCT')}
            className={
              'flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ' +
              (type === 'DEDUCT' ? 'border-warning/30 bg-warning-light text-warning' : 'border-border text-muted hover:bg-bg')
            }
          >
            Deduct
          </button>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" onClick={handleLog}>
            <Plus className="size-4" />
            Log
          </Button>
          <Button variant="secondary" onClick={handleExport}>
            <Download className="size-4" />
            Excel
          </Button>
        </div>
      </Card>

      <Card title="Log">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium text-muted">
                <th className="py-2.5 pr-3">Date</th>
                <th className="py-2.5 pr-3">Employee</th>
                <th className="py-2.5 pr-3">Item</th>
                <th className="py-2.5 pr-3">Price</th>
                <th className="py-2.5 pr-3">Type</th>
                <th className="py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-muted">
                    No entries
                  </td>
                </tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.id} className="border-b border-border last:border-b-0">
                    <td className="py-2.5 pr-3 text-muted">{formatDateTime(l.date)}</td>
                    <td className="py-2.5 pr-3 font-medium text-ink">{l.employee}</td>
                    <td className="py-2.5 pr-3 text-ink">{l.itemName}</td>
                    <td className="py-2.5 pr-3 text-ink">{money(l.price, currency, usdRate)}</td>
                    <td className="py-2.5 pr-3">
                      <Badge tone={l.type === 'FREE' ? 'green' : 'amber'}>{l.type === 'FREE' ? 'Free' : 'Deduct'}</Badge>
                    </td>
                    <td className="py-2.5">
                      {can('employees_manage') && (
                        <Button size="sm" variant="danger" onClick={() => setDeleteId(l.id)}>
                          <X className="size-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {summary.length > 0 && (
          <>
            <div className="my-4 border-t border-border" />
            <div className="mb-3 text-sm font-semibold text-ink">Monthly summary</div>
            <StatGrid>
              {summary.map((s) => (
                <div key={s.name} className="rounded-2xl border border-border bg-surface p-4">
                  <div className="mb-1.5 text-[13px] font-medium text-muted">{s.name}</div>
                  <div className="text-sm font-semibold text-success">Free: {money(s.free, currency, usdRate)}</div>
                  <div className="text-sm font-semibold text-danger">Deduct: {money(s.deduct, currency, usdRate)}</div>
                </div>
              ))}
            </StatGrid>
          </>
        )}
      </Card>

      <ConfirmModal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && remove.mutate(deleteId)}
        title="Delete entry?"
        message="This log entry will be permanently removed."
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
