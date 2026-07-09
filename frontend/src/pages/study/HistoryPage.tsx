import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as api from '../../api/studyEndpoints';
import { formatDateTime, money } from '../../lib/format';
import { Badge, Card, PageHeader, Pill, StatCard, StatGrid } from '../../components/ui';
import type { StudyBookingStatus } from '../../types';

export function HistoryPage() {
  const [filter, setFilter] = useState<StudyBookingStatus>('COMPLETED');
  const bookingsQuery = useQuery({ queryKey: ['study', 'bookings', filter], queryFn: () => api.getBookings(filter) });
  const configQuery = useQuery({ queryKey: ['study', 'config'], queryFn: api.getConfig });
  const currency = configQuery.data?.currency ?? 'SYP';

  const bookings = bookingsQuery.data ?? [];
  const totalRevenue = useMemo(() => bookings.reduce((s, b) => s + (b.paid ? b.roomFee : 0), 0), [bookings]);

  return (
    <div>
      <PageHeader title="History" description="Past bookings — completed sessions and cancellations." />

      <StatGrid>
        <StatCard label="Sessions" value={bookings.length} />
        <StatCard label="Room fee revenue" value={money(totalRevenue, currency)} tone="var(--color-accent-dark)" />
        <StatCard label="With a drink" value={bookings.filter((b) => b.drinkCount > 0).length} />
      </StatGrid>

      <Card
        title="Bookings"
        action={
          <div className="flex gap-1.5">
            {(['COMPLETED', 'CANCELLED'] as const).map((s) => (
              <Pill key={s} active={filter === s} onClick={() => setFilter(s)}>
                {s === 'COMPLETED' ? 'Completed' : 'Cancelled'}
              </Pill>
            ))}
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium text-muted">
                <th className="py-2.5 pr-3">Resource</th>
                <th className="py-2.5 pr-3">Customer</th>
                <th className="py-2.5 pr-3">Start</th>
                <th className="py-2.5 pr-3">Hours</th>
                <th className="py-2.5 pr-3">Room fee</th>
                <th className="py-2.5 pr-3">Drink</th>
                <th className="py-2.5">Payment</th>
              </tr>
            </thead>
            <tbody>
              {bookings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-muted">
                    No bookings yet
                  </td>
                </tr>
              ) : (
                bookings.map((b) => (
                  <tr key={b.id} className="border-b border-border last:border-b-0">
                    <td className="py-2.5 pr-3 font-medium text-ink">{b.table.label ?? `#${b.table.number}`}</td>
                    <td className="py-2.5 pr-3 text-muted">{b.customerName || 'Walk-in'}</td>
                    <td className="py-2.5 pr-3 text-xs text-muted">{formatDateTime(b.startTime)}</td>
                    <td className="py-2.5 pr-3 text-ink">{b.hours}h</td>
                    <td className="py-2.5 pr-3 font-semibold text-ink">{money(b.roomFee, currency)}</td>
                    <td className="py-2.5 pr-3">{b.drinkCount > 0 ? <Badge tone="blue">×{b.drinkCount}</Badge> : <span className="text-muted-2">—</span>}</td>
                    <td className="py-2.5">
                      {b.paid ? <Badge tone={b.paymentMethod === 'CASH' ? 'green' : 'blue'}>{b.paymentMethod}</Badge> : <Badge tone="gray">Unpaid</Badge>}
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
