import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Download, FileText, Save } from 'lucide-react';
import * as api from '../api/endpoints';
import { useToast } from '../lib/toast';
import { apiErrorMessage } from '../lib/api';
import { exportToExcel, todayFileStamp } from '../lib/excel';
import { formatDateTime } from '../lib/format';
import { openTrackerHistoryPdf } from '../lib/receipt';
import { Alert, Badge, Button, Card, Input, PageHeader } from '../components/ui';

export function TrackerPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const rowsQuery = useQuery({ queryKey: ['tracker'], queryFn: api.getTrackerRows });
  const historyQuery = useQuery({ queryKey: ['tracker', 'history'], queryFn: api.getTrackerHistory });
  const [counts, setCounts] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: (payload: { stockItemId: string; physicalQty: number }[]) => api.saveTrackerCounts(payload),
    onSuccess: (res) => {
      setCounts({});
      qc.invalidateQueries({ queryKey: ['tracker'] });
      qc.invalidateQueries({ queryKey: ['stock'] });
      toast.show(`Reconciled ${res.saved} item${res.saved === 1 ? '' : 's'} — stock updated to match your count`, 'success');
    },
    onError: (e) => toast.show(apiErrorMessage(e), 'error'),
  });

  function handleSave() {
    const payload = Object.entries(counts)
      .filter(([, v]) => v !== '')
      .map(([stockItemId, v]) => ({ stockItemId, physicalQty: parseFloat(v) }));
    if (!payload.length) {
      toast.show('Enter at least one count');
      return;
    }
    save.mutate(payload);
  }

  function handleExport() {
    const history = historyQuery.data ?? [];
    if (!history.length) {
      toast.show('No history');
      return;
    }
    const rows: (string | number)[][] = [['Date', 'Item', 'System Qty', 'Physical Count', 'Difference']];
    history.forEach((h) => rows.push([formatDateTime(h.date), h.item, h.system, h.physical, h.diff]));
    exportToExcel(`StudioCafe_Tracker_${todayFileStamp()}.xlsx`, 'Tracker', rows);
    toast.show('Exported!', 'success');
  }

  async function handleExportPdf() {
    try {
      await openTrackerHistoryPdf();
    } catch (e) {
      toast.show(apiErrorMessage(e), 'error');
    }
  }

  const rows = rowsQuery.data ?? [];
  const history = historyQuery.data ?? [];

  return (
    <div>
      <PageHeader
        title="Weekly stock tracker"
        description="Count physical stock every week to correct drift from sales, waste, and manual entry mistakes."
        actions={
          <>
            <Button variant="primary" onClick={handleSave}>
              <Save className="size-4" />
              Save count
            </Button>
            <Button variant="secondary" onClick={handleExport}>
              <Download className="size-4" />
              Excel
            </Button>
            <Button variant="secondary" onClick={handleExportPdf}>
              <FileText className="size-4" />
              PDF
            </Button>
          </>
        }
      />

      <Card>
        <Alert tone="warn">
          <AlertTriangle className="size-4 shrink-0" />
          Enter what you physically counted below. Saving updates the system stock to match — this is a real
          reconciliation, not just a comparison, so only save once you've actually counted.
        </Alert>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium text-muted">
                <th className="py-2.5 pr-3">Item</th>
                <th className="py-2.5 pr-3">System qty</th>
                <th className="py-2.5 pr-3">Physical count</th>
                <th className="py-2.5 pr-3">Difference</th>
                <th className="py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const physical = counts[r.id] ?? '';
                const diff = physical !== '' ? parseFloat(physical) - r.systemQty : null;
                return (
                  <tr key={r.id} className="border-b border-border last:border-b-0">
                    <td className="py-2.5 pr-3">
                      <div className="font-medium text-ink">{r.name}</div>
                      {r.nameAr && (
                        <div dir="rtl" lang="ar" className="text-xs text-muted">
                          {r.nameAr}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 font-semibold text-ink">
                      {r.systemQty} {r.unit}
                    </td>
                    <td className="py-2.5 pr-3">
                      <Input
                        type="number"
                        placeholder="Count"
                        className="w-24 py-1.5"
                        value={physical}
                        onChange={(e) => setCounts({ ...counts, [r.id]: e.target.value })}
                      />
                    </td>
                    <td className={'py-2.5 pr-3 font-semibold ' + (diff === null ? 'text-muted-2' : diff > 0 ? 'text-danger' : diff < 0 ? 'text-success' : 'text-muted')}>
                      {diff === null ? '—' : `${diff > 0 ? '+' : ''}${diff} ${r.unit}`}
                    </td>
                    <td className="py-2.5">
                      {diff === null ? (
                        <span className="text-muted-2">—</span>
                      ) : diff > 0 ? (
                        <Badge tone="red">More used</Badge>
                      ) : diff < 0 ? (
                        <Badge tone="green">Less used</Badge>
                      ) : (
                        <Badge tone="gray">Match</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="History">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium text-muted">
                <th className="py-2.5 pr-3">Date</th>
                <th className="py-2.5 pr-3">Item</th>
                <th className="py-2.5 pr-3">System</th>
                <th className="py-2.5 pr-3">Physical</th>
                <th className="py-2.5">Diff</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-muted">
                    No history yet
                  </td>
                </tr>
              ) : (
                history.map((h) => (
                  <tr key={h.id} className="border-b border-border last:border-b-0">
                    <td className="py-2.5 pr-3 text-ink">{formatDateTime(h.date)}</td>
                    <td className="py-2.5 pr-3 text-ink">{h.item}</td>
                    <td className="py-2.5 pr-3 text-muted">{h.system}</td>
                    <td className="py-2.5 pr-3 text-muted">{h.physical}</td>
                    <td className={'py-2.5 font-semibold ' + (h.diff > 0 ? 'text-danger' : h.diff < 0 ? 'text-success' : 'text-muted')}>
                      {h.diff > 0 ? '+' : ''}
                      {h.diff}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
