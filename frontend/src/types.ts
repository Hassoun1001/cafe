export interface MenuItemDto {
  id: string;
  name: string;
  nameAr: string | null;
  sub: string;
  price: number;
  active: boolean;
  sortOrder: number;
  categoryId: string;
}

export interface MenuCategoryDto {
  id: string;
  name: string;
  sortOrder: number;
  items: MenuItemDto[];
}

export interface TableOpenOrderSummary {
  id: string;
  orderNumber: number;
  itemCount: number;
  total: number;
}

export interface CafeTableDto {
  id: string;
  number: number;
  label: string | null;
  active: boolean;
  openOrder: TableOpenOrderSummary | null;
}

export interface OrderLineDto {
  id: string;
  menuItemId: string | null;
  name: string;
  price: number;
  qty: number;
  lineTotal: number;
}

export interface OrderTaxDto {
  taxRateId: string | null;
  name: string;
  percent: number;
  compound: boolean;
  amount: number;
}

export type OrderStatus = 'OPEN' | 'PAID' | 'CANCELLED';
export type PaymentMethod = 'CASH' | 'CARD';

export interface OrderDto {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  table: { id: string; number: number; label: string | null };
  items: OrderLineDto[];
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  taxes: OrderTaxDto[];
  taxAmount: number;
  total: number;
  paymentMethod: PaymentMethod | null;
  cashReceived: number | null;
  changeGiven: number | null;
  openedAt: string;
  closedAt: string | null;
}

export interface StockItemDto {
  id: string;
  name: string;
  nameAr: string | null;
  category: string;
  unit: string;
  qty: number;
  minQty: number;
  costPerUnit: number;
}

export interface TrackerRowDto {
  id: string;
  name: string;
  nameAr: string | null;
  unit: string;
  systemQty: number;
}

export interface TrackerHistoryDto {
  id: string;
  date: string;
  item: string;
  system: number;
  physical: number;
  diff: number;
}

export interface EmployeeDto {
  id: string;
  name: string;
  nameAr: string | null;
  active: boolean;
}

export type ConsumptionType = 'FREE' | 'DEDUCT';

export interface ConsumptionLogDto {
  id: string;
  date: string;
  employee: string;
  employeeAr: string | null;
  itemName: string;
  price: number;
  type: ConsumptionType;
}

export interface ConsumptionSummaryDto {
  name: string;
  free: number;
  deduct: number;
}

export interface ConsumptionResponseDto {
  logs: ConsumptionLogDto[];
  summary: ConsumptionSummaryDto[];
}

export type ReportGroupBy = 'day' | 'week' | 'month';

export interface ReportsSummaryDto {
  range: { from: string; to: string };
  groupBy: ReportGroupBy;
  revenue: number;
  orderCount: number;
  avgOrder: number;
  taxCollected: number;
  employeeCost: number;
  paymentSplit: { cash: number; card: number };
  trend: { date: string; total: number }[];
  topItems: { name: string; qty: number; revenue: number }[];
  lowStock: { id: string; name: string; qty: number; unit: string; minQty: number }[];
}

export interface SettingsDto {
  receiptName: string;
  receiptFooter: string;
  currency: string;
}

export interface DiscountPresetDto {
  id: string;
  name: string;
  percent: number;
  active: boolean;
}

export interface TaxRateDto {
  id: string;
  name: string;
  percent: number;
  compound: boolean;
  defaultOn: boolean;
  active: boolean;
  sortOrder: number;
}

export interface StockCategoryDto {
  id: string;
  name: string;
  sortOrder: number;
}

export interface StockUnitDto {
  id: string;
  name: string;
  sortOrder: number;
}

export interface RecipeIngredientDto {
  id: string;
  stockItemId: string;
  stockItemName: string;
  unit: string;
  qtyPerUnit: number;
}
