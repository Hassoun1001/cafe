import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Minus, Plus, X } from 'lucide-react';
import * as api from '../api/endpoints';
import { useToast } from '../lib/toast';
import { apiErrorMessage } from '../lib/api';
import { Alert, Badge, Button, Card, Input, Label, PageHeader, Select, StatCard, StatGrid } from '../components/ui';

export function WarehousePage() {
  const qc = useQueryClient();
  const toast = useToast();
  const stockQuery = useQuery({ queryKey: ['stock'], queryFn: api.getStock });
  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: api.getSettings });
  const categoriesQuery = useQuery({ queryKey: ['settings', 'stock-categories'], queryFn: api.getStockCategories });
  const unitsQuery = useQuery({ queryKey: ['settings', 'stock-units'], queryFn: api.getStockUnits });
  const currency = settingsQuery.data?.currency ?? 'SYP';
  const categories = categoriesQuery.data ?? [];
  const units = unitsQuery.data ?? [];

  const [form, setForm] = useState({ name: '', nameAr: '', qty: '', unit: '', minQty: '', costPerUnit: '', category: '' });
  const [setInputs, setSetInputs] = useState<Record<string, string>>({});
  const formUnit = form.unit || units[0]?.name || '';
  const formCategory = form.category || categories[0]?.name || '';

  // Selling a recipe-linked item deducts stock, and the weekly Tracker reads
  // the same StockItem rows — invalidate both whenever stock changes here.
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['stock'] });
    qc.invalidateQueries({ queryKey: ['tracker'] });
  };

  const addOrRestock = useMutation({
    mutationFn: api.addOrRestock,
    onSuccess: (res: { restocked: boolean }) => {
      invalidate();
      setForm({ name: '', nameAr: '', qty: '', unit: '', minQty: '', costPerUnit: '', category: '' });
      toast.show(res.restocked ? 'Restocked!' : 'Added!', 'success');
    },
    onError: (e) => toast.show(apiErrorMessage(e), 'error'),
  });

  const adjust = useMutation({
    mutationFn: (vars: { id: string; delta?: number; setTo?: number; reason: string; note?: string }) =>
      api.adjustStock(vars.id, vars),
    onSuccess: invalidate,
    onError: (e) => toast.show(apiErrorMessage(e), 'error'),
  });

  const updateItem = useMutation({
    mutationFn: (vars: { id: string; nameAr: string }) => api.updateStockItem(vars.id, { nameAr: vars.nameAr }),
    onSuccess: () => invalidate(),
    onError: (e) => toast.show(apiErrorMessage(e), 'error'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteStockItem(id),
    onSuccess: () => {
      invalidate();
      toast.show('Removed');
    },
    onError: (e) => toast.show(apiErrorMessage(e), 'error'),
  });

  const stock = stockQuery.data ?? [];
  const low = stock.filter((s) => s.qty <= s.minQty);
  const value = stock.reduce((s, x) => s + x.qty * x.costPerUnit, 0);

  function handleAdd() {
    if (!form.name.trim()) {
      toast.show('Enter name');
      return;
    }
    if (!formUnit || !formCategory) {
      toast.show('Add at least one unit and category in Settings first', 'error');
      return;
    }
    addOrRestock.mutate({
      name: form.name.trim(),
      nameAr: form.nameAr.trim() || undefined,
      qty: parseFloat(form.qty) || 0,
      unit: formUnit,
      minQty: parseFloat(form.minQty) || 1,
      costPerUnit: parseFloat(form.costPerUnit) || 0,
      category: formCategory,
    });
  }

  return (
    <div>
      <PageHeader title="Warehouse" description="Track ingredient and supply levels." />
      <StatGrid>
        <StatCard label="Items" value={stock.length} />
        <StatCard label="Low alerts" value={low.length} tone={low.length ? 'var(--color-danger)' : 'var(--color-success)'} />
        <StatCard label="Stock value" value={Math.round(value / 1000) + 'K'} />
      </StatGrid>

      {low.length > 0 ? (
        <Alert tone="warn">
          <AlertTriangle className="size-4 shrink-0" />
          Low stock: {low.map((s) => s.name).join(', ')}
        </Alert>
      ) : (
        <Alert tone="success">
          <CheckCircle2 className="size-4 shrink-0" />
          All stock levels are healthy
        </Alert>
      )}

      <Card title="Add or restock">
        <div className="mb-3 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
          <div>
            <Label>Item name</Label>
            <Input placeholder="e.g. Coffee beans" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Item name (Arabic, optional)</Label>
            <Input dir="rtl" placeholder="حبوب القهوة" value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} />
          </div>
          <div>
            <Label>Qty</Label>
            <Input type="number" placeholder="10" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} />
          </div>
          <div>
            <Label>Unit</Label>
            <Select value={formUnit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
              {units.length === 0 && <option value="">No units yet</option>}
              {units.map((u) => (
                <option key={u.id} value={u.name}>
                  {u.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
          <div>
            <Label>Alert below</Label>
            <Input type="number" placeholder="2" value={form.minQty} onChange={(e) => setForm({ ...form, minQty: e.target.value })} />
          </div>
          <div>
            <Label>Cost/unit ({currency})</Label>
            <Input type="number" placeholder="100000" value={form.costPerUnit} onChange={(e) => setForm({ ...form, costPerUnit: e.target.value })} />
          </div>
          <div>
            <Label>Category</Label>
            <Select value={formCategory} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {categories.length === 0 && <option value="">No categories yet</option>}
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <Button variant="primary" onClick={handleAdd}>
          <Plus className="size-4" />
          Add item
        </Button>
      </Card>

      <Card title="Stock list">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium text-muted">
                <th className="py-2.5 pr-3">Item (English)</th>
                <th className="py-2.5 pr-3">Item (Arabic)</th>
                <th className="py-2.5 pr-3">Category</th>
                <th className="py-2.5 pr-3">Qty</th>
                <th className="py-2.5 pr-3">Unit</th>
                <th className="py-2.5 pr-3">Min</th>
                <th className="py-2.5 pr-3">Status</th>
                <th className="py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {stock.map((s) => {
                const isLow = s.qty <= s.minQty;
                return (
                  <tr key={s.id} className="border-b border-border last:border-b-0 hover:bg-bg/60">
                    <td className="py-2.5 pr-3 font-medium text-ink">{s.name}</td>
                    <td className="py-2.5 pr-3">
                      <Input
                        dir="rtl"
                        className="w-36 py-1.5"
                        placeholder="أضف الاسم"
                        defaultValue={s.nameAr ?? ''}
                        key={`${s.id}-${s.nameAr}`}
                        onBlur={(e) => {
                          if (e.target.value !== (s.nameAr ?? '')) updateItem.mutate({ id: s.id, nameAr: e.target.value });
                        }}
                      />
                    </td>
                    <td className="py-2.5 pr-3">
                      <Badge tone="gray">{s.category}</Badge>
                    </td>
                    <td className={'py-2.5 pr-3 font-semibold ' + (isLow ? 'text-danger' : 'text-ink')}>{s.qty}</td>
                    <td className="py-2.5 pr-3 text-muted">{s.unit}</td>
                    <td className="py-2.5 pr-3 text-muted">{s.minQty}</td>
                    <td className="py-2.5 pr-3">
                      <Badge tone={isLow ? 'red' : 'green'}>{isLow ? 'Low' : 'OK'}</Badge>
                    </td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-1.5">
                        <Button size="sm" variant="secondary" onClick={() => adjust.mutate({ id: s.id, delta: 1, reason: 'MANUAL_DELTA' })}>
                          <Plus className="size-3.5" />
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => adjust.mutate({ id: s.id, delta: -1, reason: 'MANUAL_DELTA' })}>
                          <Minus className="size-3.5" />
                        </Button>
                        <Input
                          type="number"
                          placeholder="Set"
                          className="w-[64px] py-1.5"
                          value={setInputs[s.id] ?? ''}
                          onChange={(e) => setSetInputs({ ...setInputs, [s.id]: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const n = parseFloat(setInputs[s.id] ?? '');
                              if (!Number.isNaN(n) && n >= 0) {
                                adjust.mutate({ id: s.id, setTo: n, reason: 'MANUAL_SET' });
                                setSetInputs({ ...setInputs, [s.id]: '' });
                              }
                            }
                          }}
                        />
                        <Button size="sm" variant="danger" onClick={() => remove.mutate(s.id)}>
                          <X className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
