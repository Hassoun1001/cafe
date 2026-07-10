import { Prisma, StudyBookingStatus, PaymentMethod, TableKind } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { toNum, round2 } from '../lib/decimal';
import { badRequest, notFound } from '../lib/errors';
import * as ordersService from './orders.service';
import { getStudyConfig } from './studyConfig.service';

// A STUDY_TABLE grants 90 free minutes per drink ordered (stacking — 2
// drinks = 180 min free) before the hourly rate starts applying to the
// remainder. A STUDY_ROOM always bills its full elapsed time regardless of
// drinks ordered.
//
// Billed by whole hour, paid upfront per block — not prorated per minute.
// Any time into an hour (even 1 minute) bills that full hour, same as an
// hourly parking/co-working rate. Time still fully covered by free
// drink-minutes stays free (0 hours billed).
const FREE_MINUTES_PER_DRINK = 90;

function computeBilling(kind: TableKind, startTime: Date, endTime: Date, hourlyRate: Prisma.Decimal | number, drinkCount: number) {
  const elapsedMinutes = Math.max(0, (endTime.getTime() - startTime.getTime()) / 60000);
  const freeMinutes = kind === 'STUDY_TABLE' ? drinkCount * FREE_MINUTES_PER_DRINK : 0;
  const billableMinutes = Math.max(0, elapsedMinutes - freeMinutes);
  const hours = Math.ceil(billableMinutes / 60);
  const fee = round2(hours * toNum(hourlyRate));
  return { hours, fee };
}

const bookingInclude = { table: true } satisfies Prisma.StudyBookingInclude;
type BookingWithTable = Prisma.StudyBookingGetPayload<{ include: typeof bookingInclude }>;

function serializeBooking(b: BookingWithTable) {
  return {
    id: b.id,
    table: { id: b.table.id, number: b.table.number, label: b.table.label, kind: b.table.kind },
    status: b.status,
    customerName: b.customerName,
    startTime: b.startTime,
    endTime: b.endTime,
    hours: toNum(b.hours),
    hourlyRate: toNum(b.hourlyRate),
    roomFee: toNum(b.roomFee),
    drinkCount: b.drinkCount,
    cafeOrderId: b.cafeOrderId,
    paid: b.paid,
    paymentMethod: b.paymentMethod,
    createdAt: b.createdAt,
  };
}

export async function listBookings(status?: StudyBookingStatus) {
  const bookings = await prisma.studyBooking.findMany({
    where: status ? { status } : undefined,
    include: bookingInclude,
    orderBy: { startTime: 'desc' },
  });
  return bookings.map(serializeBooking);
}

export async function createBooking(tableId: string, customerName?: string) {
  const table = await prisma.cafeTable.findUnique({ where: { id: tableId } });
  if (!table) throw notFound('Resource not found');
  if (table.kind === 'DINING') throw badRequest('Not a study resource', 'NOT_STUDY_RESOURCE');

  const activeExisting = await prisma.studyBooking.findFirst({ where: { tableId, status: 'ACTIVE' } });
  if (activeExisting) throw badRequest('This resource already has an active booking', 'RESOURCE_BUSY');

  const cfg = await getStudyConfig();
  const hourlyRate = table.kind === 'STUDY_ROOM' ? cfg.roomHourlyRate : cfg.tableHourlyRate;

  const booking = await prisma.studyBooking.create({
    data: {
      tableId,
      customerName,
      startTime: new Date(),
      hourlyRate,
    },
    include: bookingInclude,
  });
  return serializeBooking(booking);
}

// Every drink goes through the exact same addItem/stock/tax pipeline as any
// dining-table order. For a STUDY_TABLE, each drink also grants 90 minutes
// of free table time at settlement — that free time isn't applied here,
// only the running drinkCount is; the actual fee is computed live on the
// frontend and authoritatively at completeBooking/cancelBooking time.
export async function addDrink(bookingId: string, menuItemId: string) {
  const booking = await prisma.studyBooking.findUnique({ where: { id: bookingId } });
  if (!booking) throw notFound('Booking not found');
  if (booking.status !== 'ACTIVE') throw badRequest('Booking is not active', 'BOOKING_NOT_ACTIVE');

  let orderId = booking.cafeOrderId;
  if (!orderId) {
    const order = await ordersService.openOrderForTable(booking.tableId);
    orderId = order.id;
  }
  await ordersService.addItem(orderId, menuItemId);

  const updated = await prisma.studyBooking.update({
    where: { id: bookingId },
    data: { cafeOrderId: orderId, drinkCount: { increment: 1 } },
    include: bookingInclude,
  });
  return serializeBooking(updated);
}

export async function updateBooking(id: string, data: { customerName?: string }) {
  const existing = await prisma.studyBooking.findUnique({ where: { id } });
  if (!existing) throw notFound('Booking not found');

  const updated = await prisma.studyBooking.update({
    where: { id },
    data: { customerName: data.customerName },
    include: bookingInclude,
  });
  return serializeBooking(updated);
}

// Restarts the billing clock to right now — for renewing a session after
// the customer has paid for the current hour, without a full checkout +
// re-book cycle. Keeps everything else about the booking (customer,
// drinkCount so far) unchanged. Only valid while still genuinely ACTIVE and
// not yet room-paid — once the room fee is checked out the clock is frozen
// and the booking is just waiting on the linked Cafe order, not something
// to restart.
export async function resetTimer(id: string) {
  const existing = await prisma.studyBooking.findUnique({ where: { id } });
  if (!existing) throw notFound('Booking not found');
  if (existing.status !== 'ACTIVE') throw badRequest('Booking is not active', 'BOOKING_NOT_ACTIVE');
  if (existing.paid) throw badRequest('Room/table fee already checked out — this can no longer be reset', 'ALREADY_ROOM_PAID');

  const updated = await prisma.studyBooking.update({
    where: { id },
    data: { startTime: new Date() },
    include: bookingInclude,
  });
  return serializeBooking(updated);
}

// Checkout settles ONLY the room/table fee (computed automatically from
// actual elapsed time — never entered manually) and freezes the clock. If a
// drink was ordered, that Cafe order is deliberately left untouched — it
// must be paid or voided separately through the normal Cafe checkout (tax,
// receipt, Sales history) at `/pos` or the Cafe Tables page's Study tab. The
// booking stays ACTIVE (resource still occupied, un-rebookable) until that
// happens; completeLinkedStudyBookingIfReady in orders.service.ts finalizes
// it to COMPLETED the moment the linked order is paid or voided there. If
// there's no drink order (or it's already been settled), checkout finishes
// immediately in one step, same as before.
export async function completeBooking(id: string, paymentMethod: PaymentMethod) {
  const existing = await prisma.studyBooking.findUnique({ where: { id }, include: bookingInclude });
  if (!existing) throw notFound('Booking not found');
  if (existing.status !== 'ACTIVE') throw badRequest('Booking is not active', 'BOOKING_NOT_ACTIVE');
  if (existing.paid) throw badRequest('Room/table fee already checked out — waiting on the Cafe order', 'ALREADY_ROOM_PAID');

  let linkedOrderSettled = true;
  if (existing.cafeOrderId) {
    const order = await prisma.order.findUnique({ where: { id: existing.cafeOrderId } });
    linkedOrderSettled = !order || order.status !== 'OPEN';
  }

  const endTime = new Date();
  const { hours, fee } = computeBilling(existing.table.kind, existing.startTime, endTime, existing.hourlyRate, existing.drinkCount);

  const updated = await prisma.studyBooking.update({
    where: { id },
    data: {
      paid: true,
      paymentMethod,
      endTime,
      hours,
      roomFee: fee,
      status: linkedOrderSettled ? 'COMPLETED' : 'ACTIVE',
    },
    include: bookingInclude,
  });
  return serializeBooking(updated);
}

// No-show / ended early without paying — releases the resource but keeps
// the record (distinct from deleteBooking, which erases it entirely). Any
// unpaid linked drink order is cancelled too, restoring its stock. The
// accrued time/fee is still computed and stored for the History record,
// but stays unpaid — cancel never collects payment.
export async function cancelBooking(id: string) {
  const existing = await prisma.studyBooking.findUnique({ where: { id }, include: bookingInclude });
  if (!existing) throw notFound('Booking not found');
  if (existing.status !== 'ACTIVE') throw badRequest('Booking is not active', 'BOOKING_NOT_ACTIVE');
  if (existing.paid) throw badRequest('Room/table fee already checked out — this can no longer be cancelled', 'ALREADY_ROOM_PAID');

  if (existing.cafeOrderId) {
    const order = await prisma.order.findUnique({ where: { id: existing.cafeOrderId } });
    if (order && order.status === 'OPEN') {
      await ordersService.deleteOrder(order.id);
    }
  }

  const endTime = new Date();
  const { hours, fee } = computeBilling(existing.table.kind, existing.startTime, endTime, existing.hourlyRate, existing.drinkCount);

  const updated = await prisma.studyBooking.update({
    where: { id },
    data: { status: 'CANCELLED', endTime, hours, roomFee: fee },
    include: bookingInclude,
  });
  return serializeBooking(updated);
}

// Mistake correction — removes the booking entirely. If it has a linked
// Cafe order that's still OPEN (unpaid), that gets cancelled too (restoring
// any stock deducted); an already-PAID order is left alone since it's now a
// real historical sale.
export async function deleteBooking(id: string) {
  const existing = await prisma.studyBooking.findUnique({ where: { id } });
  if (!existing) throw notFound('Booking not found');
  if (existing.cafeOrderId) {
    const order = await prisma.order.findUnique({ where: { id: existing.cafeOrderId } });
    if (order && order.status === 'OPEN') {
      await ordersService.deleteOrder(order.id);
    }
  }
  await prisma.studyBooking.delete({ where: { id } });
}
