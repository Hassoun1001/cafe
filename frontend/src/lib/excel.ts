import * as XLSX from 'xlsx';

export function exportToExcel(filename: string, sheetName: string, rows: (string | number)[][]) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

export function todayFileStamp(): string {
  return new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
}
