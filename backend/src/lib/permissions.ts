import type { AppSystem } from '@prisma/client';

// The full catalog of grantable permissions, one entry per action that used
// to be a blanket `requireAdmin` gate. ADMIN accounts always have every
// permission implicitly and never consult this list — it only matters for
// STAFF, who get none of these by default (matching the previous ADMIN/STAFF
// behavior) unless explicitly checked in the Team Access checkbox matrix.
// Keep `key` in sync with backend/src/middleware/permissions.ts usage and
// with frontend/src/lib/permissions.ts (the checkbox UI reads the same list).
export interface PermissionDef {
  key: string;
  label: string;
  group: string;
}

export const CAFE_PERMISSIONS: PermissionDef[] = [
  { key: 'settings_general', label: 'Edit receipt, currency & exchange rate', group: 'Settings' },
  { key: 'danger_zone', label: 'Danger zone (clear sales/employee log, full reset)', group: 'Settings' },
  { key: 'tax_manage', label: 'Manage tax rates', group: 'Pricing' },
  { key: 'discounts_manage', label: 'Manage discount presets', group: 'Pricing' },
  { key: 'menu_manage', label: 'Manage menu categories, items, prices & recipes', group: 'Menu' },
  { key: 'stock_catalog_manage', label: 'Manage stock categories & units', group: 'Stock' },
  { key: 'stock_delete', label: 'Delete a stock item', group: 'Stock' },
  { key: 'tables_manage', label: 'Manage cafe tables', group: 'Tables' },
  { key: 'employees_manage', label: 'Manage employee records & delete consumption log entries', group: 'Employees' },
  { key: 'users_manage', label: 'Manage user accounts & permissions', group: 'Users' },
  { key: 'import_legacy', label: 'Import legacy sales (Excel)', group: 'Sales' },
  { key: 'sales_edit', label: 'Edit an already-recorded sale', group: 'Sales' },
  { key: 'sales_delete', label: 'Delete a historical sale', group: 'Sales' },
];

export const STUDY_PERMISSIONS: PermissionDef[] = [
  { key: 'study_resources_manage', label: 'Manage study tables & rooms', group: 'Resources' },
  { key: 'study_config_manage', label: 'Manage hourly rates', group: 'Resources' },
  { key: 'study_users_manage', label: 'Manage user accounts & permissions', group: 'Users' },
  { key: 'study_bookings_delete', label: 'Delete a booking (correction)', group: 'Bookings' },
];

export function permissionsForSystem(system: AppSystem): PermissionDef[] {
  return system === 'CAFE' ? CAFE_PERMISSIONS : STUDY_PERMISSIONS;
}

export function validPermissionKeys(system: AppSystem): Set<string> {
  return new Set(permissionsForSystem(system).map((p) => p.key));
}
