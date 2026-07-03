import { api } from '../lib/api';
import type {
  CafeTableDto,
  ConsumptionResponseDto,
  ConsumptionType,
  DiscountPresetDto,
  EmployeeDto,
  MenuCategoryDto,
  OrderDto,
  RecipeIngredientDto,
  ReportGroupBy,
  ReportsSummaryDto,
  SettingsDto,
  StockCategoryDto,
  StockItemDto,
  StockUnitDto,
  TaxRateDto,
  TrackerHistoryDto,
  TrackerRowDto,
} from '../types';

// Auth
export const login = (password: string) => api.post<{ token: string }>('/auth/login', { password }).then((r) => r.data);
export const changePassword = (currentPassword: string, newPassword: string) =>
  api.post('/auth/change-password', { currentPassword, newPassword }).then((r) => r.data);

// Menu
export const getMenu = () => api.get<MenuCategoryDto[]>('/menu').then((r) => r.data);
export const createCategory = (name: string) => api.post('/menu/categories', { name }).then((r) => r.data);
export const updateCategory = (id: string, name: string) => api.put(`/menu/categories/${id}`, { name }).then((r) => r.data);
export const deleteCategory = (id: string) => api.delete(`/menu/categories/${id}`);
export const createMenuItem = (data: { name: string; nameAr?: string; sub?: string; price?: number; categoryId: string }) =>
  api.post('/menu/items', data).then((r) => r.data);
export const updateMenuItem = (
  id: string,
  data: Partial<{ name: string; nameAr: string; sub: string; price: number; categoryId: string; active: boolean }>,
) => api.put(`/menu/items/${id}`, data).then((r) => r.data);
export const deleteMenuItem = (id: string) => api.delete(`/menu/items/${id}`);
export const bulkSaveItems = (edits: { id: string; price?: number; nameAr?: string }[]) =>
  api.patch('/menu/items/prices', { edits }).then((r) => r.data);
export const getRecipe = (menuItemId: string) => api.get<RecipeIngredientDto[]>(`/menu/items/${menuItemId}/recipe`).then((r) => r.data);
export const setRecipeIngredient = (menuItemId: string, stockItemId: string, qtyPerUnit: number) =>
  api.post<RecipeIngredientDto[]>(`/menu/items/${menuItemId}/recipe`, { stockItemId, qtyPerUnit }).then((r) => r.data);
export const removeRecipeIngredient = (menuItemId: string, stockItemId: string) =>
  api.delete<RecipeIngredientDto[]>(`/menu/items/${menuItemId}/recipe/${stockItemId}`).then((r) => r.data);

// Tables
export const getTables = () => api.get<CafeTableDto[]>('/tables').then((r) => r.data);
export const createTable = (data: { number: number; label?: string }) => api.post('/tables', data).then((r) => r.data);
export const deleteTable = (id: string) => api.delete(`/tables/${id}`);

// Orders
export const getOpenOrders = () => api.get<OrderDto[]>('/orders/open').then((r) => r.data);
export const getOrder = (id: string) => api.get<OrderDto>(`/orders/${id}`).then((r) => r.data);
export const openOrderForTable = (tableId: string) => api.post<OrderDto>('/orders', { tableId }).then((r) => r.data);
export const addOrderItem = (orderId: string, menuItemId: string) =>
  api.post<OrderDto>(`/orders/${orderId}/items`, { menuItemId }).then((r) => r.data);
export const setLineQty = (orderId: string, lineId: string, qty: number) =>
  api.patch<OrderDto>(`/orders/${orderId}/items/${lineId}`, { qty }).then((r) => r.data);
export const removeLine = (orderId: string, lineId: string) =>
  api.delete<OrderDto>(`/orders/${orderId}/items/${lineId}`).then((r) => r.data);
export const patchOrder = (orderId: string, data: { discountPercent?: number }) =>
  api.patch<OrderDto>(`/orders/${orderId}`, data).then((r) => r.data);
export const addOrderTax = (orderId: string, taxRateId: string) =>
  api.post<OrderDto>(`/orders/${orderId}/taxes`, { taxRateId }).then((r) => r.data);
export const removeOrderTax = (orderId: string, taxRateId: string) =>
  api.delete<OrderDto>(`/orders/${orderId}/taxes/${taxRateId}`).then((r) => r.data);
export const payOrder = (orderId: string, method: 'CASH' | 'CARD', cashReceived?: number) =>
  api.post<OrderDto>(`/orders/${orderId}/pay`, { method, cashReceived }).then((r) => r.data);
export const clearOrder = (orderId: string) => api.delete(`/orders/${orderId}`);
export const getSalesHistory = (params: {
  from?: string;
  to?: string;
  table?: number;
  payment?: string;
  page?: number;
  pageSize?: number;
}) =>
  api
    .get<{ total: number; page: number; pageSize: number; orders: OrderDto[] }>('/orders/history', { params })
    .then((r) => r.data);
export const receiptPdfUrl = (orderId: string) => `/orders/${orderId}/receipt.pdf`;

// Stock
export const getStock = () => api.get<StockItemDto[]>('/stock').then((r) => r.data);
export const addOrRestock = (data: {
  name: string;
  nameAr?: string;
  qty: number;
  unit: string;
  minQty: number;
  costPerUnit: number;
  category: string;
}) => api.post('/stock', data).then((r) => r.data);
export const updateStockItem = (
  id: string,
  data: Partial<{ name: string; nameAr: string; category: string; unit: string; minQty: number; costPerUnit: number }>,
) => api.put<StockItemDto>(`/stock/${id}`, data).then((r) => r.data);
export const adjustStock = (
  id: string,
  data: { delta?: number; setTo?: number; reason: string; note?: string },
) => api.patch(`/stock/${id}/adjust`, data).then((r) => r.data);
export const deleteStockItem = (id: string) => api.delete(`/stock/${id}`);

// Tracker
export const getTrackerRows = () => api.get<TrackerRowDto[]>('/tracker').then((r) => r.data);
export const getTrackerHistory = () => api.get<TrackerHistoryDto[]>('/tracker/history').then((r) => r.data);
export const saveTrackerCounts = (counts: { stockItemId: string; physicalQty: number }[]) =>
  api.post<{ saved: number }>('/tracker', { counts }).then((r) => r.data);

// Employees
export const getEmployees = () => api.get<EmployeeDto[]>('/employees').then((r) => r.data);
export const createEmployee = (data: { name: string; nameAr?: string }) => api.post('/employees', data).then((r) => r.data);
export const deleteEmployee = (id: string) => api.delete(`/employees/${id}`);
export const getConsumption = () => api.get<ConsumptionResponseDto>('/employees/consumption').then((r) => r.data);
export const logConsumption = (data: {
  employeeId: string;
  itemName: string;
  price: number;
  type: ConsumptionType;
}) => api.post('/employees/consumption', data).then((r) => r.data);
export const deleteConsumption = (id: string) => api.delete(`/employees/consumption/${id}`);

// Reports
export const getReportsSummary = (from?: string, to?: string, groupBy?: ReportGroupBy) =>
  api.get<ReportsSummaryDto>('/reports/summary', { params: { from, to, groupBy } }).then((r) => r.data);

// Settings
export const getSettings = () => api.get<SettingsDto>('/settings').then((r) => r.data);
export const updateSettings = (data: Partial<SettingsDto>) => api.patch<SettingsDto>('/settings', data).then((r) => r.data);
export const getDiscountPresets = () => api.get<DiscountPresetDto[]>('/settings/discount-presets').then((r) => r.data);
export const createDiscountPreset = (data: { name: string; percent: number }) =>
  api.post('/settings/discount-presets', data).then((r) => r.data);
export const deleteDiscountPreset = (id: string) => api.delete(`/settings/discount-presets/${id}`);
export const getTaxRates = () => api.get<TaxRateDto[]>('/settings/tax-rates').then((r) => r.data);
export const createTaxRate = (data: { name: string; percent: number; compound?: boolean; defaultOn?: boolean }) =>
  api.post<TaxRateDto>('/settings/tax-rates', data).then((r) => r.data);
export const updateTaxRate = (
  id: string,
  data: Partial<{ name: string; percent: number; compound: boolean; defaultOn: boolean; active: boolean }>,
) => api.put<TaxRateDto>(`/settings/tax-rates/${id}`, data).then((r) => r.data);
export const deleteTaxRate = (id: string) => api.delete(`/settings/tax-rates/${id}`);
export const getStockCategories = () => api.get<StockCategoryDto[]>('/settings/stock-categories').then((r) => r.data);
export const createStockCategory = (name: string) => api.post<StockCategoryDto>('/settings/stock-categories', { name }).then((r) => r.data);
export const deleteStockCategory = (id: string) => api.delete(`/settings/stock-categories/${id}`);
export const getStockUnits = () => api.get<StockUnitDto[]>('/settings/stock-units').then((r) => r.data);
export const createStockUnit = (name: string) => api.post<StockUnitDto>('/settings/stock-units', { name }).then((r) => r.data);
export const deleteStockUnit = (id: string) => api.delete(`/settings/stock-units/${id}`);
export const clearSales = () => api.post('/settings/danger/clear-sales').then((r) => r.data);
export const clearEmployeeLog = () => api.post('/settings/danger/clear-employee-log').then((r) => r.data);
export const resetAll = () => api.post('/settings/danger/reset-all').then((r) => r.data);
