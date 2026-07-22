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

export type TableKind = 'DINING' | 'STUDY_TABLE' | 'STUDY_ROOM';

export interface CafeTableDto {
  id: string;
  number: number;
  label: string | null;
  kind: TableKind;
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
  manualAmount: number | null;
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
  changeGiven: number;
  paymentSplit: { cash: number; card: number };
  trend: { date: string; total: number }[];
  topItems: { name: string; qty: number; revenue: number }[];
  itemSales: { name: string; qty: number; revenue: number }[];
  lowStock: { id: string; name: string; qty: number; unit: string; minQty: number }[];
}

export interface ItemSalesReportDto {
  range: { from: string; to: string };
  item: string | null;
  totalQty: number;
  totalRevenue: number;
  rows: { name: string; qty: number; revenue: number }[] | { date: string; qty: number; revenue: number }[];
}

export interface SettingsDto {
  receiptName: string;
  receiptFooter: string;
  currency: string;
  usdExchangeRate: number;
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

export type UserRole = 'ADMIN' | 'STAFF';

export interface UserDto {
  id: string;
  username: string;
  role: UserRole;
  permissions: string[];
  active: boolean;
  createdAt: string;
}

// One grantable action from the permission catalog — see PermissionDef in
// backend/src/lib/permissions.ts (fetched via GET /users/permissions or
// /study/users/permissions, not hardcoded here, so the two stay in sync).
export interface PermissionDefDto {
  key: string;
  label: string;
  group: string;
}

export interface ImportResultDto {
  imported: number;
  alreadyImported: number;
  skipped: number;
  skippedDetails: string[];
}

// --- Study booking system ---

export type StudyBookingStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export interface StudyResourceDto {
  id: string;
  number: number;
  label: string | null;
  kind: TableKind;
  active: boolean;
  openOrder: TableOpenOrderSummary | null;
}

export interface StudyBookingDto {
  id: string;
  table: { id: string; number: number; label: string | null; kind: TableKind };
  status: StudyBookingStatus;
  customerName: string | null;
  startTime: string;
  endTime: string | null;
  hours: number;
  hourlyRate: number;
  roomFee: number;
  drinkCount: number;
  cafeOrderId: string | null;
  paid: boolean;
  paymentMethod: 'CASH' | 'CARD' | null;
  createdAt: string;
}

export interface StudyConfigDto {
  id: string;
  tableHourlyRate: number;
  roomHourlyRate: number;
  currency: string;
  // Cafe-owned (set in Cafe Settings), read-only here — null if not configured.
  usdExchangeRate: number | null;
}
