import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate } from '../middleware/auth';
import {
  openOrderSchema,
  addItemSchema,
  setLineQtySchema,
  patchOrderSchema,
  orderTaxSchema,
  paySchema,
  salesHistoryQuerySchema,
} from '../schemas/orders.schema';
import * as ordersService from '../services/orders.service';
import { buildReceiptPdf } from '../lib/pdf';
import { getAppConfig } from '../services/config.service';

export const ordersRouter = Router();
ordersRouter.use(authenticate);

ordersRouter.get(
  '/open',
  asyncHandler(async (_req, res) => {
    res.json(await ordersService.listOpenOrders());
  }),
);

ordersRouter.get(
  '/history',
  asyncHandler(async (req, res) => {
    const query = salesHistoryQuerySchema.parse(req.query);
    res.json(await ordersService.listSalesHistory(query));
  }),
);

ordersRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { tableId } = openOrderSchema.parse(req.body);
    res.status(201).json(await ordersService.openOrderForTable(tableId));
  }),
);

ordersRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(await ordersService.getOrder(req.params.id));
  }),
);

ordersRouter.post(
  '/:id/items',
  asyncHandler(async (req, res) => {
    const { menuItemId } = addItemSchema.parse(req.body);
    res.json(await ordersService.addItem(req.params.id, menuItemId));
  }),
);

ordersRouter.patch(
  '/:id/items/:lineId',
  asyncHandler(async (req, res) => {
    const { qty } = setLineQtySchema.parse(req.body);
    res.json(await ordersService.setLineQty(req.params.id, req.params.lineId, qty));
  }),
);

ordersRouter.delete(
  '/:id/items/:lineId',
  asyncHandler(async (req, res) => {
    res.json(await ordersService.removeLine(req.params.id, req.params.lineId));
  }),
);

ordersRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = patchOrderSchema.parse(req.body);
    res.json(await ordersService.patchOrder(req.params.id, data));
  }),
);

ordersRouter.post(
  '/:id/taxes',
  asyncHandler(async (req, res) => {
    const { taxRateId } = orderTaxSchema.parse(req.body);
    res.json(await ordersService.addTaxToOrder(req.params.id, taxRateId));
  }),
);

ordersRouter.delete(
  '/:id/taxes/:taxRateId',
  asyncHandler(async (req, res) => {
    res.json(await ordersService.removeTaxFromOrder(req.params.id, req.params.taxRateId));
  }),
);

ordersRouter.post(
  '/:id/pay',
  asyncHandler(async (req, res) => {
    const { method, cashReceived } = paySchema.parse(req.body);
    res.json(await ordersService.payOrder(req.params.id, method, cashReceived));
  }),
);

ordersRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await ordersService.deleteOrder(req.params.id);
    res.status(204).end();
  }),
);

ordersRouter.get(
  '/:id/receipt.pdf',
  asyncHandler(async (req, res) => {
    const order = await ordersService.getOrder(req.params.id);
    const cfg = await getAppConfig();
    const doc = buildReceiptPdf({
      shopName: cfg.receiptName,
      footer: cfg.receiptFooter,
      orderNumber: order.orderNumber,
      tableNumber: order.table.number,
      dateStr: new Date(order.closedAt ?? order.openedAt).toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      items: order.items.map((i) => ({ name: i.name, qty: i.qty, lineTotal: i.lineTotal })),
      subtotal: order.subtotal,
      discountPercent: order.discountPercent,
      discountAmount: order.discountAmount,
      taxes: order.taxes.map((t) => ({ name: t.name, percent: t.percent, amount: t.amount })),
      total: order.total,
      currency: cfg.currency,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="receipt-${order.orderNumber}.pdf"`);
    doc.pipe(res);
  }),
);
