import PDFDocument from 'pdfkit';

const RECEIPT_WIDTH = 227; // ~80mm thermal-receipt width, in points

export interface ReceiptData {
  shopName: string;
  footer: string;
  orderNumber: number;
  tableNumber: number;
  dateStr: string;
  items: { name: string; qty: number; lineTotal: number }[];
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  taxes: { name: string; percent: number; amount: number }[];
  total: number;
  currency: string;
}

function money(n: number, currency: string) {
  return `${Math.round(n).toLocaleString('en-US')} ${currency}`;
}

export function buildReceiptPdf(data: ReceiptData): PDFKit.PDFDocument {
  const lineHeight = 14;
  const headerHeight = 90;
  const itemsHeight = data.items.length * lineHeight;
  const totalsHeight = 90 + (data.discountAmount ? lineHeight : 0) + data.taxes.length * lineHeight;
  const footerHeight = 50;
  const height = headerHeight + itemsHeight + totalsHeight + footerHeight;

  const doc = new PDFDocument({ size: [RECEIPT_WIDTH, height], margin: 12 });

  const center = (text: string, opts: PDFKit.Mixins.TextOptions = {}) =>
    doc.text(text, { align: 'center', ...opts });
  const dashedLine = () => {
    doc.moveDown(0.2);
    center('- '.repeat(20));
    doc.moveDown(0.2);
  };
  const row = (left: string, right: string) => {
    const y = doc.y;
    doc.font('Courier').fontSize(9);
    doc.text(left, doc.page.margins.left, y, { width: RECEIPT_WIDTH - 24 - 60, continued: false });
    doc.text(right, RECEIPT_WIDTH - doc.page.margins.right - 60, y, { width: 60, align: 'right' });
  };

  doc.font('Helvetica-Bold').fontSize(14);
  center(data.shopName);
  doc.font('Courier').fontSize(8);
  doc.moveDown(0.3);
  center(`Table ${data.tableNumber} — Order #${data.orderNumber}`);
  center(data.dateStr);
  dashedLine();

  data.items.forEach((i) => {
    row(`${i.qty}x ${i.name}`, money(i.lineTotal, data.currency));
  });

  dashedLine();
  row('Subtotal', money(data.subtotal, data.currency));
  if (data.discountAmount > 0) {
    row(`Discount (${data.discountPercent}%)`, `-${money(data.discountAmount, data.currency)}`);
  }
  data.taxes.forEach((t) => {
    row(`${t.name} (${t.percent}%)`, money(t.amount, data.currency));
  });
  doc.moveDown(0.3);
  doc.font('Helvetica-Bold').fontSize(11);
  row('TOTAL', money(data.total, data.currency));
  dashedLine();
  doc.font('Courier').fontSize(8);
  center(data.footer);

  doc.end();
  return doc;
}
