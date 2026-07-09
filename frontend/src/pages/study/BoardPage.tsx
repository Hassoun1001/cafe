import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Coffee, Plus, Check, Ban, Trash2, Search } from 'lucide-react';
import * as api from '../../api/studyEndpoints';
import { useToast } from '../../lib/toast';
import { apiErrorMessage } from '../../lib/api';
import { money } from '../../lib/format';
import { computeLiveBilling, formatMinutes } from '../../lib/studyBilling';
import { Alert, Badge, Button, Card, ConfirmModal, Input, Label, Modal, PageHeader, Pill } from '../../components/ui';
import type { StudyBookingDto, StudyResourceDto, TableKind } from '../../types';

function useNow(intervalMs = 15000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function resourceKindLabel(kind: TableKind) {
  return kind === 'STUDY_ROOM' ? 'room' : 'table';
}

export function BoardPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const now = useNow();

  const resourcesQuery = useQuery({ queryKey: ['study', 'resources'], queryFn: api.getResources, refetchInterval: 8000 });
  const bookingsQuery = useQuery({ queryKey: ['study', 'bookings', 'active'], queryFn: () => api.getBookings('ACTIVE'), refetchInterval: 8000 });
  const menuQuery = useQuery({ queryKey: ['study', 'menu'], queryFn: api.getMenu });
  const configQuery = useQuery({ queryKey: ['study', 'config'], queryFn: api.getConfig });
  const currency = configQuery.data?.currency ?? 'SYP';

  const [bookModalTable, setBookModalTable] = useState<StudyResourceDto | null>(null);
  const [customerName, setCustomerName] = useState('');

  const [drinkModalBooking, setDrinkModalBooking] = useState<StudyBookingDto | null>(null);
  const [drinkSearch, setDrinkSearch] = useState('');
  const [drinkCategory, setDrinkCategory] = useState('All');

  const [checkoutBooking, setCheckoutBooking] = useState<StudyBookingDto | null>(null);
  const [cancelBookingId, setCancelBookingId] = useState<string | null>(null);
  const [deleteBookingId, setDeleteBookingId] = useState<string | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['study', 'resources'] });
    qc.invalidateQueries({ queryKey: ['study', 'bookings'] });
  };

  const createBooking = useMutation({
    mutationFn: () => api.createBooking(bookModalTable!.id, customerName.trim() || undefined),
    onSuccess: () => {
      invalidate();
      setBookModalTable(null);
      setCustomerName('');
      toast.show('Booked!', 'success');
    },
    onError: (e) => toast.show(apiErrorMessage(e), 'error'),
  });

  const addDrink = useMutation({
    mutationFn: (itemId: string) => api.addDrink(drinkModalBooking!.id, itemId),
    onSuccess: (updated) => {
      invalidate();
      setDrinkModalBooking(updated);
      toast.show('Drink added', 'success');
    },
    onError: (e) => toast.show(apiErrorMessage(e), 'error'),
  });

  const completeBooking = useMutation({
    mutationFn: (method: 'CASH' | 'CARD') => api.completeBooking(checkoutBooking!.id, method),
    onSuccess: () => {
      invalidate();
      setCheckoutBooking(null);
      toast.show('Checked out', 'success');
    },
    onError: (e) => toast.show(apiErrorMessage(e), 'error'),
  });

  const cancelBooking = useMutation({
    mutationFn: (id: string) => api.cancelBooking(id),
    onSuccess: () => {
      invalidate();
      setCancelBookingId(null);
      toast.show('Booking cancelled');
    },
    onError: (e) => {
      setCancelBookingId(null);
      toast.show(apiErrorMessage(e), 'error');
    },
  });

  const deleteBooking = useMutation({
    mutationFn: (id: string) => api.deleteBooking(id),
    onSuccess: () => {
      invalidate();
      setDeleteBookingId(null);
      toast.show('Booking removed');
    },
    onError: (e) => {
      setDeleteBookingId(null);
      toast.show(apiErrorMessage(e), 'error');
    },
  });

  const resources = resourcesQuery.data ?? [];
  const bookings = bookingsQuery.data ?? [];
  const bookingByTable = useMemo(() => new Map(bookings.map((b) => [b.table.id, b])), [bookings]);
  const tables = resources.filter((r) => r.kind === 'STUDY_TABLE');
  const rooms = resources.filter((r) => r.kind === 'STUDY_ROOM');

  const menuCategories = menuQuery.data ?? [];
  const categoryNames = useMemo(() => ['All', ...menuCategories.map((c) => c.name)], [menuCategories]);
  const drinkItems = useMemo(() => {
    const all = menuCategories.flatMap((c) => c.items.map((i) => ({ ...i, categoryName: c.name })));
    const q = drinkSearch.trim().toLowerCase();
    return all.filter((i) => {
      const inCategory = drinkCategory === 'All' || i.categoryName === drinkCategory;
      const matchesSearch = q === '' || i.name.toLowerCase().includes(q) || (i.nameAr ?? '').toLowerCase().includes(q);
      return inCategory && matchesSearch;
    });
  }, [menuCategories, drinkCategory, drinkSearch]);

  function openDrinkModal(booking: StudyBookingDto) {
    setDrinkSearch('');
    setDrinkCategory('All');
    setDrinkModalBooking(booking);
  }

  function ResourceCard({ resource }: { resource: StudyResourceDto }) {
    const booking = bookingByTable.get(resource.id);
    // Once the room/table fee is checked out (paid), the clock freezes —
    // endTime is set and booking.hours/roomFee are the final stored values,
    // not a live-ticking estimate. Still ACTIVE (resource stays occupied)
    // until the linked drink order is also settled from the Cafe side.
    const awaitingCafeCheckout = !!booking?.paid;
    const billing =
      booking && !awaitingCafeCheckout ? computeLiveBilling(resource.kind, booking.startTime, now, booking.hourlyRate, booking.drinkCount) : null;
    return (
      <div className={'rounded-2xl border p-4 ' + (booking ? 'border-warning/30 bg-warning-light' : 'border-border bg-surface')}>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-semibold text-ink">{resource.label ?? `#${resource.number}`}</div>
          <Badge tone={booking ? 'amber' : 'green'}>{booking ? 'Booked' : 'Free'}</Badge>
        </div>
        {booking && awaitingCafeCheckout ? (
          <>
            <div className="mb-1 text-xs text-muted">{booking.customerName || 'Walk-in'}</div>
            <div className="mb-1 text-sm font-semibold text-ink">
              {formatMinutes(booking.hours * 60)} · {money(booking.roomFee, currency)} paid
            </div>
            <div className="mb-3 flex items-center gap-1 text-xs text-warning">
              <Coffee className="size-3.5" />
              Waiting on {booking.drinkCount} drink{booking.drinkCount > 1 ? 's' : ''} — pay in Cafe → Tables → Study tab
            </div>
            <Button size="sm" variant="danger" className="w-full" onClick={() => setDeleteBookingId(booking.id)}>
              <Trash2 className="size-3.5" />
              Remove (correction)
            </Button>
          </>
        ) : booking && billing ? (
          <>
            <div className="mb-1 text-xs text-muted">{booking.customerName || 'Walk-in'}</div>
            <div className="mb-1 text-sm font-semibold text-ink">Elapsed: {formatMinutes(billing.elapsedMinutes)}</div>
            {billing.freeMinutes > 0 && (
              <div className="mb-1 text-xs text-success">
                {billing.billableMinutes === 0
                  ? `${formatMinutes(billing.freeMinutes - billing.elapsedMinutes)} free time left`
                  : `${formatMinutes(billing.freeMinutes)} free time used`}
              </div>
            )}
            <div className="mb-3 text-sm font-semibold text-warning">{billing.fee > 0 ? `${money(billing.fee, currency)} so far` : 'Free so far'}</div>
            {booking.drinkCount > 0 && (
              <div className="mb-3 flex items-center gap-1 text-xs text-muted">
                <Coffee className="size-3.5" />
                {booking.drinkCount} drink{booking.drinkCount > 1 ? 's' : ''} added
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" variant="secondary" onClick={() => openDrinkModal(booking)}>
                <Coffee className="size-3.5" />
                {booking.drinkCount > 0 ? 'Add more' : 'Add drink'}
              </Button>
              <Button size="sm" variant="primary" onClick={() => setCheckoutBooking(booking)}>
                <Check className="size-3.5" />
                Checkout
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setCancelBookingId(booking.id)}>
                <Ban className="size-3.5" />
              </Button>
              <Button size="sm" variant="danger" onClick={() => setDeleteBookingId(booking.id)}>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </>
        ) : (
          <Button size="sm" variant="primary" className="w-full" onClick={() => setBookModalTable(resource)}>
            <Plus className="size-3.5" />
            Book
          </Button>
        )}
      </div>
    );
  }

  const checkoutBilling = checkoutBooking
    ? computeLiveBilling(checkoutBooking.table.kind, checkoutBooking.startTime, now, checkoutBooking.hourlyRate, checkoutBooking.drinkCount)
    : null;

  return (
    <div>
      <PageHeader
        title="Board"
        description="9 study tables and 2 rooms — billed automatically by actual time. Tables get 1h30m free per drink; rooms always pay full time."
      />

      <Card title="Study tables">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
          {tables.map((r) => (
            <ResourceCard key={r.id} resource={r} />
          ))}
        </div>
      </Card>

      <Card title="Rooms">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
          {rooms.map((r) => (
            <ResourceCard key={r.id} resource={r} />
          ))}
        </div>
      </Card>

      <Modal open={!!bookModalTable} onClose={() => setBookModalTable(null)} title={`Book ${bookModalTable?.label ?? ''}`}>
        <div className="mb-5">
          <Label>Customer name (optional)</Label>
          <Input autoFocus value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="e.g. Ahmad" />
        </div>
        <div className="flex gap-2">
          <Button variant="primary" className="flex-1" onClick={() => createBooking.mutate()}>
            Book
          </Button>
          <Button variant="secondary" onClick={() => setBookModalTable(null)}>
            Cancel
          </Button>
        </div>
      </Modal>

      <Modal
        open={!!drinkModalBooking}
        onClose={() => setDrinkModalBooking(null)}
        title={`Add a drink — ${drinkModalBooking?.table.label ?? ''}`}
        maxWidth="800px"
      >
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-2" />
          <Input
            autoFocus
            placeholder="Search menu (English or Arabic)…"
            value={drinkSearch}
            onChange={(e) => setDrinkSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          {categoryNames.map((c) => (
            <Pill key={c} active={c === drinkCategory} onClick={() => setDrinkCategory(c)}>
              {c}
            </Pill>
          ))}
        </div>
        <div className="grid max-h-[50vh] grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2.5 overflow-y-auto pb-1">
          {drinkItems.map((item) => (
            <button
              key={item.id}
              disabled={addDrink.isPending}
              onClick={() => addDrink.mutate(item.id)}
              className="flex min-h-[76px] flex-col justify-between rounded-xl border border-border bg-surface p-3 text-left transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-[var(--shadow-card)] active:translate-y-0 active:scale-[0.98] disabled:opacity-50"
            >
              <div className="text-[13px] font-semibold leading-tight text-ink">{item.name}</div>
              {item.nameAr && (
                <div dir="rtl" lang="ar" className="mt-0.5 text-[12px] font-medium leading-tight text-muted">
                  {item.nameAr}
                </div>
              )}
            </button>
          ))}
          {drinkItems.length === 0 && <div className="col-span-full py-6 text-center text-sm text-muted">No items match</div>}
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="secondary" onClick={() => setDrinkModalBooking(null)}>
            Done
          </Button>
        </div>
      </Modal>

      <Modal open={!!checkoutBooking} onClose={() => setCheckoutBooking(null)} title="Checkout">
        {checkoutBooking && checkoutBilling && (
          <>
            <div className="mb-4 rounded-xl bg-bg p-4 text-sm">
              <div className="flex justify-between py-1">
                <span className="text-muted">Elapsed time</span>
                <span className="font-semibold text-ink">{formatMinutes(checkoutBilling.elapsedMinutes)}</span>
              </div>
              {checkoutBilling.freeMinutes > 0 && (
                <div className="flex justify-between py-1">
                  <span className="text-muted">Free time (from drinks)</span>
                  <span className="font-semibold text-success">{formatMinutes(checkoutBilling.freeMinutes)}</span>
                </div>
              )}
              <div className="flex justify-between py-1">
                <span className="text-muted">Billable time</span>
                <span className="font-semibold text-ink">{formatMinutes(checkoutBilling.billableMinutes)}</span>
              </div>
              <div className="flex justify-between border-t border-border py-1 pt-2">
                <span className="text-muted">Table/room fee</span>
                <span className="font-semibold text-ink">{money(checkoutBilling.fee, currency)}</span>
              </div>
              {checkoutBooking.drinkCount > 0 && (
                <div className="flex justify-between py-1 text-muted">
                  <span>+ {checkoutBooking.drinkCount} drink order</span>
                  <span>billed separately in Cafe</span>
                </div>
              )}
            </div>
            {checkoutBooking.drinkCount > 0 && (
              <Alert tone="warn">
                This pays the {resourceKindLabel(checkoutBooking.table.kind)} fee only. The {resourceKindLabel(checkoutBooking.table.kind)} stays
                booked until the drink order is also paid or cleared from Cafe → Tables → Study tab.
              </Alert>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="primary" size="lg" onClick={() => completeBooking.mutate('CASH')}>
                Cash
              </Button>
              <Button size="lg" className="bg-info text-white hover:bg-blue-700" onClick={() => completeBooking.mutate('CARD')}>
                Card
              </Button>
            </div>
          </>
        )}
      </Modal>

      <ConfirmModal
        open={!!cancelBookingId}
        onClose={() => setCancelBookingId(null)}
        onConfirm={() => cancelBookingId && cancelBooking.mutate(cancelBookingId)}
        title="Cancel booking?"
        message="This ends the session without payment (no-show / left early). Any unpaid drink order tied to it is cancelled too."
        confirmLabel="Cancel booking"
        danger
      />

      <ConfirmModal
        open={!!deleteBookingId}
        onClose={() => setDeleteBookingId(null)}
        onConfirm={() => deleteBookingId && deleteBooking.mutate(deleteBookingId)}
        title="Remove booking?"
        message="This permanently deletes the booking record (use this to correct a mistake, not to end a real session — use Cancel for that)."
        confirmLabel="Remove"
        danger
      />
    </div>
  );
}
