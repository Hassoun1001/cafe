import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate } from '../middleware/auth';
import { reportsQuerySchema } from '../schemas/reports.schema';
import * as reportsService from '../services/reports.service';
import * as ordersService from '../services/orders.service';
import * as stockService from '../services/stock.service';
import * as employeesService from '../services/employees.service';
import { getSettings } from '../services/settings.service';
import { createReportDoc, drawStats, drawTable } from '../lib/reportPdf';
import { formatDateTime, money, streamPdf } from '../lib/reportFormat';
import { endOfDayExclusive } from '../lib/dates';

export const reportsRouter = Router();
reportsRouter.use(authenticate);

reportsRouter.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const query = reportsQuerySchema.parse(req.query);
    res.json(await reportsService.reportsSummary(query));
  }),
);

reportsRouter.get(
  '/sales.pdf',
  asyncHandler(async (req, res) => {
    const { from, to } = reportsQuerySchema.parse(req.query);
    const [summary, history, settings] = await Promise.all([
      reportsService.reportsSummary({ from, to }),
      ordersService.listSalesHistory({ from, to, page: 1, pageSize: 100000 }),
      getSettings(),
    ]);

    const doc = createReportDoc('Sales Report', `${formatDateTime(summary.range.from)} to ${formatDateTime(summary.range.to)} - Generated ${formatDateTime(new Date())}`);
    drawStats(doc, [
      { label: 'Revenue', value: money(summary.revenue, settings.currency) },
      { label: 'Orders', value: String(summary.orderCount) },
      { label: 'Avg order', value: money(summary.avgOrder, settings.currency) },
      { label: 'Tax collected', value: money(summary.taxCollected, settings.currency) },
      { label: 'Cash', value: money(summary.paymentSplit.cash, settings.currency) },
      { label: 'Card', value: money(summary.paymentSplit.card, settings.currency) },
    ]);
    drawTable(
      doc,
      [
        { header: 'Order#', width: 45 },
        { header: 'Table', width: 40 },
        { header: 'Date', width: 85 },
        { header: 'Items', width: 190 },
        { header: 'Payment', width: 50 },
        { header: 'Tax', width: 55, align: 'right' },
        { header: 'Total', width: 65, align: 'right' },
      ],
      history.orders.map((o) => [
        `#${o.orderNumber}`,
        `T${o.table.number}`,
        formatDateTime(o.closedAt ?? o.openedAt),
        o.items.map((i) => `${i.qty}x ${i.name}`).join(', '),
        o.paymentMethod ?? '',
        money(o.taxAmount, settings.currency),
        money(o.total, settings.currency),
      ]),
    );
    streamPdf(res, doc, 'sales-report.pdf');
  }),
);

reportsRouter.get(
  '/stock.pdf',
  asyncHandler(async (_req, res) => {
    const [stock, settings] = await Promise.all([stockService.listStock(), getSettings()]);
    const doc = createReportDoc('Stock Report', `Generated ${formatDateTime(new Date())}`);
    const value = stock.reduce((s, x) => s + x.qty * x.costPerUnit, 0);
    drawStats(doc, [
      { label: 'Items', value: String(stock.length) },
      { label: 'Low alerts', value: String(stock.filter((s) => s.qty <= s.minQty).length) },
      { label: 'Stock value', value: money(value, settings.currency) },
    ]);
    drawTable(
      doc,
      [
        { header: 'Item', width: 130 },
        { header: 'Category', width: 110 },
        { header: 'Qty', width: 55, align: 'right' },
        { header: 'Unit', width: 45 },
        { header: 'Min', width: 45, align: 'right' },
        { header: 'Cost/unit', width: 65, align: 'right' },
        { header: 'Value', width: 80, align: 'right' },
      ],
      stock.map((s) => [
        s.name,
        s.category,
        s.qty,
        s.unit,
        s.minQty,
        money(s.costPerUnit, settings.currency),
        money(s.qty * s.costPerUnit, settings.currency),
      ]),
    );
    streamPdf(res, doc, 'stock-report.pdf');
  }),
);

reportsRouter.get(
  '/employees.pdf',
  asyncHandler(async (req, res) => {
    const { from, to } = reportsQuerySchema.parse(req.query);
    const [consumption, settings] = await Promise.all([employeesService.listConsumption(), getSettings()]);
    const logs = consumption.logs.filter((l) => {
      const d = new Date(l.date);
      if (from && d < new Date(from)) return false;
      // `to` is a date-only string (e.g. "2026-07-04") — parsed directly
      // it's midnight UTC, so comparing against it directly would exclude
      // nearly the whole day. Compare against the start of the next day instead.
      if (to && d >= endOfDayExclusive(to)) return false;
      return true;
    });

    const doc = createReportDoc('Employee Consumption Report', `Generated ${formatDateTime(new Date())}`);
    drawStats(
      doc,
      consumption.summary.flatMap((s) => [
        { label: `${s.name} - Free`, value: money(s.free, settings.currency) },
        { label: `${s.name} - Deduct`, value: money(s.deduct, settings.currency) },
      ]),
    );
    drawTable(
      doc,
      [
        { header: 'Date', width: 100 },
        { header: 'Employee', width: 130 },
        { header: 'Item', width: 150 },
        { header: 'Price', width: 70, align: 'right' },
        { header: 'Type', width: 60 },
      ],
      logs.map((l) => [formatDateTime(l.date), l.employee, l.itemName, money(l.price, settings.currency), l.type === 'FREE' ? 'Free' : 'Deduct']),
    );
    streamPdf(res, doc, 'employees-report.pdf');
  }),
);
