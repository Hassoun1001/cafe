import PDFDocument from 'pdfkit';

const MARGIN = 40;

// A generic multi-page tabular report PDF (Letter size) — distinct from the
// narrow 80mm receipt in pdf.ts. Handles page breaks automatically when a
// table runs past the bottom margin.
export function createReportDoc(title: string, subtitle: string): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: 'LETTER', margin: MARGIN });
  doc.font('Helvetica-Bold').fontSize(18).fillColor('#0f172a').text(title);
  doc.font('Helvetica').fontSize(10).fillColor('#64748b').text(subtitle);
  doc.fillColor('#0f172a');
  doc.moveDown(1);
  return doc;
}

export function drawSectionTitle(doc: PDFKit.PDFDocument, text: string) {
  ensureSpace(doc, 24);
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a').text(text);
  doc.moveDown(0.4);
}

// A simple "label: value" stat grid, wrapped at 3 per row. Row height is
// measured from the actual wrapped text (via heightOfString) rather than a
// fixed constant, so long values that wrap to multiple lines never overlap
// whatever is drawn next.
export function drawStats(doc: PDFKit.PDFDocument, stats: { label: string; value: string }[]) {
  const colWidth = (doc.page.width - MARGIN * 2) / 3;
  const cellWidth = colWidth - 10;
  let x = doc.page.margins.left;
  let y = doc.y;
  let rowMaxHeight = 0;

  stats.forEach((s, i) => {
    if (i > 0 && i % 3 === 0) {
      y += rowMaxHeight + 10;
      x = doc.page.margins.left;
      rowMaxHeight = 0;
    }
    doc.font('Helvetica').fontSize(9).fillColor('#64748b');
    const labelHeight = doc.heightOfString(s.label, { width: cellWidth });
    doc.text(s.label, x, y, { width: cellWidth });
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#0f172a');
    const valueHeight = doc.heightOfString(s.value, { width: cellWidth });
    doc.text(s.value, x, y + labelHeight + 2, { width: cellWidth });
    rowMaxHeight = Math.max(rowMaxHeight, labelHeight + 2 + valueHeight);
    x += colWidth;
  });
  doc.y = y + rowMaxHeight + 12;
  doc.x = doc.page.margins.left;
}

function ensureSpace(doc: PDFKit.PDFDocument, height: number) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + height > bottom) {
    doc.addPage();
  }
}

export interface TableColumn {
  header: string;
  width: number;
  align?: 'left' | 'right' | 'center';
}

// Gap subtracted from each cell's usable text width so adjacent columns
// (especially a right-aligned column followed by a left-aligned one) never
// visually touch.
const CELL_PADDING = 8;

export function drawTable(doc: PDFKit.PDFDocument, columns: TableColumn[], rows: (string | number)[][]) {
  const startX = doc.page.margins.left;
  const rowHeight = 18;

  const drawHeaderRow = () => {
    ensureSpace(doc, rowHeight + 4);
    let x = startX;
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#64748b');
    columns.forEach((col) => {
      doc.text(col.header, x, doc.y, { width: col.width - CELL_PADDING, align: col.align ?? 'left' });
      x += col.width;
    });
    doc.moveDown(1);
    const lineY = doc.y;
    doc
      .moveTo(startX, lineY)
      .lineTo(startX + columns.reduce((s, c) => s + c.width, 0), lineY)
      .strokeColor('#e2e8f0')
      .stroke();
    doc.moveDown(0.3);
  };

  drawHeaderRow();
  doc.font('Helvetica').fontSize(9).fillColor('#0f172a');

  rows.forEach((row) => {
    // Measure this row's actual height first (a long "Items" cell etc. can
    // wrap to multiple lines) so it never overlaps the row drawn after it.
    const cellHeights = row.map((cell, i) => doc.heightOfString(String(cell), { width: columns[i].width - CELL_PADDING }));
    const thisRowHeight = Math.max(rowHeight, ...cellHeights);

    if (doc.y + thisRowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      drawHeaderRow();
      doc.font('Helvetica').fontSize(9).fillColor('#0f172a');
    }
    const y = doc.y;
    let x = startX;
    row.forEach((cell, i) => {
      const col = columns[i];
      doc.text(String(cell), x, y, { width: col.width - CELL_PADDING, align: col.align ?? 'left' });
      x += col.width;
    });
    doc.y = y + thisRowHeight;
  });
  doc.moveDown(1);
}
