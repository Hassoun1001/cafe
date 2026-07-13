import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ChefHat, ChevronDown, Info, KeyRound, Lock, Plus, Save, Trash2, Upload, X } from 'lucide-react';
import * as api from '../api/endpoints';
import { useToast } from '../lib/toast';
import { apiErrorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { money } from '../lib/format';
import { Badge, Button, Card, ConfirmModal, Input, Label, Modal, PageHeader, Select } from '../components/ui';
import { RecipeEditorModal } from '../components/RecipeEditorModal';
import type { ImportResultDto, MenuItemDto, UserRole } from '../types';

export function SettingsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { logout } = useAuth();

  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: api.getSettings });
  const menuQuery = useQuery({ queryKey: ['menu'], queryFn: api.getMenu });
  const employeesQuery = useQuery({ queryKey: ['employees'], queryFn: api.getEmployees });
  const presetsQuery = useQuery({ queryKey: ['discount-presets'], queryFn: api.getDiscountPresets });
  const taxRatesQuery = useQuery({ queryKey: ['tax-rates'], queryFn: api.getTaxRates });
  const stockCategoriesQuery = useQuery({ queryKey: ['settings', 'stock-categories'], queryFn: api.getStockCategories });
  const stockUnitsQuery = useQuery({ queryKey: ['settings', 'stock-units'], queryFn: api.getStockUnits });
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: api.getUsers });

  const settings = settingsQuery.data;

  // --- legacy sales import ---
  const [importResult, setImportResult] = useState<ImportResultDto | null>(null);
  const importSalesMutation = useMutation({
    mutationFn: (file: File) => api.importSalesLedger(file),
    onSuccess: (result) => {
      setImportResult(result);
      qc.invalidateQueries();
      toast.show(`Imported ${result.imported} sale${result.imported === 1 ? '' : 's'}`, 'success');
    },
    onError: (e) => toast.show(apiErrorMessage(e), 'error'),
  });

  // --- team access (cafe user accounts) ---
  const [newUsername, setNewUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('STAFF');
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const createUserMutation = useMutation({
    mutationFn: () => api.createUser(newUsername.trim(), newUserPassword, newUserRole),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setNewUsername('');
      setNewUserPassword('');
      setNewUserRole('STAFF');
      toast.show('User added', 'success');
    },
    onError: (e) => toast.show(apiErrorMessage(e), 'error'),
  });
  const toggleUserActive = useMutation({
    mutationFn: (vars: { id: string; active: boolean }) => api.updateUser(vars.id, { active: vars.active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
    onError: (e) => toast.show(apiErrorMessage(e), 'error'),
  });
  const changeUserRole = useMutation({
    mutationFn: (vars: { id: string; role: UserRole }) => api.updateUser(vars.id, { role: vars.role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
    onError: (e) => toast.show(apiErrorMessage(e), 'error'),
  });
  const resetUserPasswordMutation = useMutation({
    mutationFn: () => api.resetUserPassword(resetPasswordUserId as string, resetPasswordValue),
    onSuccess: () => {
      setResetPasswordUserId(null);
      setResetPasswordValue('');
      toast.show('Password reset', 'success');
    },
    onError: (e) => toast.show(apiErrorMessage(e), 'error'),
  });
  const removeUser = useMutation({
    mutationFn: (id: string) => api.deleteUser(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setDeleteUserId(null);
      toast.show('User removed');
    },
    onError: (e) => {
      setDeleteUserId(null);
      toast.show(apiErrorMessage(e), 'error');
    },
  });

  // --- tax rates ---
  const [taxName, setTaxName] = useState('');
  const [taxPercent, setTaxPercent] = useState('');
  const [taxCompound, setTaxCompound] = useState(false);
  const [taxDefaultOn, setTaxDefaultOn] = useState(false);
  const createTaxRate = useMutation({
    mutationFn: api.createTaxRate,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tax-rates'] });
      setTaxName('');
      setTaxPercent('');
      setTaxCompound(false);
      setTaxDefaultOn(false);
      toast.show('Tax added', 'success');
    },
    onError: (e) => toast.show(apiErrorMessage(e), 'error'),
  });
  const removeTaxRate = useMutation({
    mutationFn: (id: string) => api.deleteTaxRate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tax-rates'] });
      toast.show('Removed');
    },
    onError: (e) => toast.show(apiErrorMessage(e), 'error'),
  });

  // --- recipe editor ---
  const [recipeItem, setRecipeItem] = useState<MenuItemDto | null>(null);

  // --- tables ---
  const tablesQuery = useQuery({ queryKey: ['tables'], queryFn: () => api.getTables() });
  const [newTableNumber, setNewTableNumber] = useState('');
  const [newTableLabel, setNewTableLabel] = useState('');
  const [deleteTableId, setDeleteTableId] = useState<string | null>(null);
  const createTable = useMutation({
    mutationFn: api.createTable,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tables'] });
      setNewTableNumber('');
      setNewTableLabel('');
      toast.show('Table added', 'success');
    },
    onError: (e) => toast.show(apiErrorMessage(e), 'error'),
  });
  const removeTable = useMutation({
    mutationFn: (id: string) => api.deleteTable(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tables'] });
      setDeleteTableId(null);
      toast.show('Table removed');
    },
    onError: (e) => {
      setDeleteTableId(null);
      toast.show(apiErrorMessage(e), 'error');
    },
  });

  // --- menu categories ---
  const [newCatName, setNewCatName] = useState('');
  const [deleteCatId, setDeleteCatId] = useState<string | null>(null);
  const [expandedCatId, setExpandedCatId] = useState<string | null>(null);
  const createMenuCategory = useMutation({
    mutationFn: (name: string) => api.createCategory(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu'] });
      setNewCatName('');
      toast.show('Category added', 'success');
    },
    onError: (e) => toast.show(apiErrorMessage(e), 'error'),
  });
  const renameMenuCategory = useMutation({
    mutationFn: (vars: { id: string; name: string }) => api.updateCategory(vars.id, vars.name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu'] });
      toast.show('Category renamed', 'success');
    },
    onError: (e) => toast.show(apiErrorMessage(e), 'error'),
  });
  const removeMenuCategory = useMutation({
    mutationFn: (id: string) => api.deleteCategory(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu'] });
      setDeleteCatId(null);
      toast.show('Category removed');
    },
    onError: (e) => {
      setDeleteCatId(null);
      toast.show(apiErrorMessage(e), 'error');
    },
  });

  // --- menu item add / delete ---
  const [newItemName, setNewItemName] = useState('');
  const [newItemNameAr, setNewItemNameAr] = useState('');
  const [newItemSub, setNewItemSub] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemCategoryId, setNewItemCategoryId] = useState('');
  const addMenuItem = useMutation({
    mutationFn: () =>
      api.createMenuItem({
        name: newItemName.trim(),
        nameAr: newItemNameAr.trim() || undefined,
        sub: newItemSub.trim() || undefined,
        price: parseFloat(newItemPrice) || 0,
        categoryId: newItemCategoryId,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu'] });
      setNewItemName('');
      setNewItemNameAr('');
      setNewItemSub('');
      setNewItemPrice('');
      toast.show('Item added', 'success');
    },
    onError: (e) => toast.show(apiErrorMessage(e), 'error'),
  });
  const removeMenuItem = useMutation({
    mutationFn: (id: string) => api.deleteMenuItem(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu'] });
      toast.show('Item deleted');
    },
    onError: (e) => toast.show(apiErrorMessage(e), 'error'),
  });

  // --- stock categories ---
  const [newStockCatName, setNewStockCatName] = useState('');
  const createStockCategory = useMutation({
    mutationFn: (name: string) => api.createStockCategory(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'stock-categories'] });
      setNewStockCatName('');
      toast.show('Category added', 'success');
    },
    onError: (e) => toast.show(apiErrorMessage(e), 'error'),
  });
  const removeStockCategory = useMutation({
    mutationFn: (id: string) => api.deleteStockCategory(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'stock-categories'] });
      toast.show('Removed');
    },
    onError: (e) => toast.show(apiErrorMessage(e), 'error'),
  });

  // --- stock units ---
  const [newUnitName, setNewUnitName] = useState('');
  const createUnit = useMutation({
    mutationFn: (name: string) => api.createStockUnit(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'stock-units'] });
      setNewUnitName('');
      toast.show('Unit added', 'success');
    },
    onError: (e) => toast.show(apiErrorMessage(e), 'error'),
  });
  const removeUnit = useMutation({
    mutationFn: (id: string) => api.deleteStockUnit(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'stock-units'] });
      toast.show('Removed');
    },
    onError: (e) => toast.show(apiErrorMessage(e), 'error'),
  });

  // --- tax / receipt settings ---
  const updateSettings = useMutation({
    mutationFn: api.updateSettings,
    onSuccess: (updated) => {
      qc.setQueryData(['settings'], updated);
      toast.show('Saved', 'success');
    },
    onError: (e) => toast.show(apiErrorMessage(e), 'error'),
  });

  // --- names + prices + Arabic names ---
  const [itemNameEdits, setItemNameEdits] = useState<Record<string, string>>({});
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [itemNameArEdits, setItemNameArEdits] = useState<Record<string, string>>({});
  const saveItems = useMutation({
    mutationFn: (edits: { id: string; name?: string; price?: number; nameAr?: string }[]) => api.bulkSaveItems(edits),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu'] });
      setItemNameEdits({});
      setPrices({});
      setItemNameArEdits({});
      toast.show('Saved!', 'success');
    },
    onError: (e) => toast.show(apiErrorMessage(e), 'error'),
  });

  function handleSaveItems() {
    const ids = new Set([...Object.keys(itemNameEdits), ...Object.keys(prices), ...Object.keys(itemNameArEdits)]);
    const edits = Array.from(ids).map((id) => ({
      id,
      // A blank name would fail the "at least 1 char" server validation for
      // the whole batch — treat clearing the field as "no change" instead.
      ...(itemNameEdits[id]?.trim() && { name: itemNameEdits[id].trim() }),
      ...(prices[id] !== undefined && { price: parseFloat(prices[id]) || 0 }),
      ...(itemNameArEdits[id] !== undefined && { nameAr: itemNameArEdits[id] }),
    }));
    if (edits.length === 0) {
      toast.show('No changes to save');
      return;
    }
    saveItems.mutate(edits);
  }

  // --- employees ---
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpNameAr, setNewEmpNameAr] = useState('');
  const createEmployee = useMutation({
    mutationFn: api.createEmployee,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      setNewEmpName('');
      setNewEmpNameAr('');
      toast.show('Employee added', 'success');
    },
    onError: (e) => toast.show(apiErrorMessage(e), 'error'),
  });
  const removeEmployee = useMutation({
    mutationFn: (id: string) => api.deleteEmployee(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      toast.show('Removed');
    },
    onError: (e) => toast.show(apiErrorMessage(e), 'error'),
  });

  // --- discount presets ---
  const [presetName, setPresetName] = useState('');
  const [presetPercent, setPresetPercent] = useState('');
  const createPreset = useMutation({
    mutationFn: api.createDiscountPreset,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['discount-presets'] });
      setPresetName('');
      setPresetPercent('');
      toast.show('Preset added', 'success');
    },
    onError: (e) => toast.show(apiErrorMessage(e), 'error'),
  });
  const removePreset = useMutation({
    mutationFn: (id: string) => api.deleteDiscountPreset(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['discount-presets'] });
      toast.show('Removed');
    },
    onError: (e) => toast.show(apiErrorMessage(e), 'error'),
  });

  // --- change password ---
  const [pwModalOpen, setPwModalOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const changePassword = useMutation({
    mutationFn: () => api.changePassword(currentPw, newPw),
    onSuccess: () => {
      setPwModalOpen(false);
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      toast.show('Password changed!', 'success');
    },
    onError: (e) => toast.show(apiErrorMessage(e), 'error'),
  });

  function handleChangePassword() {
    if (newPw.length < 6) {
      toast.show('New password must be at least 6 characters', 'error');
      return;
    }
    if (newPw !== confirmPw) {
      toast.show('Passwords do not match', 'error');
      return;
    }
    changePassword.mutate();
  }

  // --- danger zone ---
  const [dangerAction, setDangerAction] = useState<'sales' | 'emp' | 'reset' | null>(null);
  const clearSales = useMutation({
    mutationFn: api.clearSales,
    onSuccess: () => {
      qc.invalidateQueries();
      setDangerAction(null);
      toast.show('Cleared', 'error');
    },
  });
  const clearEmpLog = useMutation({
    mutationFn: api.clearEmployeeLog,
    onSuccess: () => {
      qc.invalidateQueries();
      setDangerAction(null);
      toast.show('Cleared', 'error');
    },
  });
  const resetAll = useMutation({
    mutationFn: api.resetAll,
    onSuccess: () => {
      qc.invalidateQueries();
      setDangerAction(null);
      toast.show('Reset done', 'error');
    },
  });

  return (
    <div>
      <PageHeader title="Settings" description="Tax, receipt branding, menu prices, team, and security." />

      <Card title="Tax rates">
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-info-light px-4 py-3 text-[13px] font-medium text-info">
          <Info className="size-4 shrink-0" />
          "Compound" taxes are calculated on top of the previous applied tax's amount instead of the bill — e.g. a 10%
          surcharge on the VAT amount itself. "Default on" taxes are pre-applied whenever a new table order is opened.
        </div>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[140px]">
            <Label>Name</Label>
            <Input value={taxName} onChange={(e) => setTaxName(e.target.value)} placeholder="e.g. VAT" />
          </div>
          <div className="w-24">
            <Label>Percent</Label>
            <Input type="number" value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} placeholder="8.1" />
          </div>
          <label className="flex cursor-pointer items-center gap-2 pb-2.5 text-sm text-ink">
            <input type="checkbox" checked={taxCompound} onChange={(e) => setTaxCompound(e.target.checked)} />
            Compound (on tax)
          </label>
          <label className="flex cursor-pointer items-center gap-2 pb-2.5 text-sm text-ink">
            <input type="checkbox" checked={taxDefaultOn} onChange={(e) => setTaxDefaultOn(e.target.checked)} />
            Default on
          </label>
          <Button
            variant="primary"
            onClick={() => {
              if (!taxName.trim() || !taxPercent) {
                toast.show('Enter name and percent');
                return;
              }
              createTaxRate.mutate({ name: taxName.trim(), percent: parseFloat(taxPercent), compound: taxCompound, defaultOn: taxDefaultOn });
            }}
          >
            <Plus className="size-4" />
            Add
          </Button>
        </div>
        <div>
          {(taxRatesQuery.data ?? []).map((t) => (
            <div key={t.id} className="flex items-center justify-between border-b border-border py-2.5 last:border-b-0">
              <span className="flex items-center gap-2 text-sm font-medium text-ink">
                {t.name} — {t.percent}%
                {t.compound && <Badge tone="amber">Compound</Badge>}
                {t.defaultOn && <Badge tone="blue">Default on</Badge>}
              </span>
              <Button size="sm" variant="danger" onClick={() => removeTaxRate.mutate(t.id)}>
                Remove
              </Button>
            </div>
          ))}
          {(taxRatesQuery.data ?? []).length === 0 && <div className="py-2 text-sm text-muted">No tax rates yet</div>}
        </div>
      </Card>

      <Card title="Receipt">
        <div className="flex items-center justify-between border-b border-border py-3.5 first:pt-0">
          <div className="text-sm font-medium text-ink">Shop name</div>
          <Input
            className="w-48"
            defaultValue={settings?.receiptName}
            key={`name-${settings?.receiptName}`}
            onBlur={(e) => updateSettings.mutate({ receiptName: e.target.value || 'Studio Cafe' })}
          />
        </div>
        <div className="flex items-center justify-between border-b border-border py-3.5">
          <div className="text-sm font-medium text-ink">Footer</div>
          <Input
            className="w-60"
            defaultValue={settings?.receiptFooter}
            key={`footer-${settings?.receiptFooter}`}
            onBlur={(e) => updateSettings.mutate({ receiptFooter: e.target.value })}
          />
        </div>
        <div className="flex items-center justify-between border-b border-border py-3.5">
          <div className="text-sm font-medium text-ink">Currency</div>
          <Input
            className="w-24"
            defaultValue={settings?.currency}
            key={`cur-${settings?.currency}`}
            onBlur={(e) => updateSettings.mutate({ currency: e.target.value || 'SYP' })}
          />
        </div>
        <div className="flex items-center justify-between py-3.5 last:pb-0">
          <div>
            <div className="text-sm font-medium text-ink">USD exchange rate</div>
            <div className="text-xs text-muted">SYP per 1 USD — shows a $ equivalent next to prices everywhere. 0 hides it.</div>
          </div>
          <Input
            type="number"
            className="w-32"
            defaultValue={settings?.usdExchangeRate}
            key={`usd-${settings?.usdExchangeRate}`}
            placeholder="e.g. 15000"
            onBlur={(e) => updateSettings.mutate({ usdExchangeRate: parseFloat(e.target.value) || 0 })}
          />
        </div>
      </Card>

      <Card title="Menu categories">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[160px]">
            <Label>Name</Label>
            <Input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="e.g. Mocktails" />
          </div>
          <Button
            variant="primary"
            onClick={() => {
              if (!newCatName.trim()) {
                toast.show('Enter a name');
                return;
              }
              createMenuCategory.mutate(newCatName.trim());
            }}
          >
            <Plus className="size-4" />
            Add category
          </Button>
        </div>
        <div>
          {(menuQuery.data ?? []).map((cat) => {
            const isExpanded = expandedCatId === cat.id;
            return (
              <div key={cat.id} className="border-b border-border last:border-b-0">
                <div className="flex items-center gap-2 py-2.5">
                  <button
                    type="button"
                    onClick={() => setExpandedCatId(isExpanded ? null : cat.id)}
                    className="shrink-0 rounded-md p-1 text-muted hover:bg-bg"
                    aria-label={isExpanded ? 'Collapse' : 'Expand'}
                  >
                    <ChevronDown className={'size-4 transition-transform ' + (isExpanded ? '' : '-rotate-90')} />
                  </button>
                  <Input
                    className="w-48 py-1.5 font-medium"
                    defaultValue={cat.name}
                    key={`${cat.id}-${cat.name}`}
                    onBlur={(e) => {
                      const value = e.target.value.trim();
                      if (value && value !== cat.name) renameMenuCategory.mutate({ id: cat.id, name: value });
                    }}
                  />
                  <span className="flex-1 text-sm text-muted">
                    {cat.items.length} item{cat.items.length === 1 ? '' : 's'}
                  </span>
                  <Button size="sm" variant="danger" onClick={() => setDeleteCatId(cat.id)}>
                    Remove
                  </Button>
                </div>
                {isExpanded && (
                  <div className="mb-3 ml-8 space-y-1 pb-1">
                    {cat.items.length === 0 ? (
                      <div className="text-xs text-muted">No items in this category yet</div>
                    ) : (
                      cat.items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between rounded-lg bg-bg px-3 py-1.5 text-xs">
                          <span className="font-medium text-ink">
                            {item.name}
                            {item.nameAr && (
                              <span dir="rtl" lang="ar" className="ml-2 text-muted">
                                {item.nameAr}
                              </span>
                            )}
                          </span>
                          <span className="text-muted">{item.price > 0 ? money(item.price, settings?.currency, settings?.usdExchangeRate) : 'price TBD'}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {(menuQuery.data ?? []).length === 0 && <div className="py-2 text-sm text-muted">No categories yet</div>}
        </div>
      </Card>

      <Card title="Menu — edit prices">
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-info-light px-4 py-3 text-[13px] font-medium text-info">
          <Info className="size-4 shrink-0" />
          Set prices here — 0 means the price isn't set yet.
        </div>
        <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] items-end gap-3 rounded-xl border border-border p-4">
          <div>
            <Label>Name</Label>
            <Input value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="e.g. Mint Lemonade" />
          </div>
          <div>
            <Label>Name (Arabic, optional)</Label>
            <Input dir="rtl" value={newItemNameAr} onChange={(e) => setNewItemNameAr(e.target.value)} placeholder="ليموناضة نعناع" />
          </div>
          <div>
            <Label>Sub / variants (optional)</Label>
            <Input value={newItemSub} onChange={(e) => setNewItemSub(e.target.value)} placeholder="e.g. Large/Small" />
          </div>
          <div>
            <Label>Category</Label>
            <Select value={newItemCategoryId} onChange={(e) => setNewItemCategoryId(e.target.value)}>
              <option value="">Select…</option>
              {(menuQuery.data ?? []).map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Price</Label>
            <Input type="number" value={newItemPrice} onChange={(e) => setNewItemPrice(e.target.value)} placeholder="0" />
          </div>
          <Button
            variant="primary"
            onClick={() => {
              if (!newItemName.trim()) {
                toast.show('Enter an item name');
                return;
              }
              if (!newItemCategoryId) {
                toast.show('Select a category');
                return;
              }
              addMenuItem.mutate();
            }}
          >
            <Plus className="size-4" />
            Add item
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium text-muted">
                <th className="py-2.5 pr-3">Item (English)</th>
                <th className="py-2.5 pr-3">Item (Arabic)</th>
                <th className="py-2.5 pr-3">Category</th>
                <th className="py-2.5 pr-3">Price</th>
                <th className="py-2.5 pr-3">Recipe</th>
                <th className="py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {(menuQuery.data ?? []).flatMap((cat) =>
                cat.items.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-b-0">
                    <td className="py-2.5 pr-3">
                      <Input
                        className="w-36 py-1.5 font-medium"
                        defaultValue={item.name}
                        onChange={(e) => setItemNameEdits((p) => ({ ...p, [item.id]: e.target.value }))}
                      />
                    </td>
                    <td className="py-2.5 pr-3">
                      <Input
                        dir="rtl"
                        className="w-36 py-1.5"
                        placeholder="أضف الاسم"
                        defaultValue={item.nameAr ?? ''}
                        onChange={(e) => setItemNameArEdits((p) => ({ ...p, [item.id]: e.target.value }))}
                      />
                    </td>
                    <td className="py-2.5 pr-3">
                      <Badge tone="gray">{cat.name}</Badge>
                    </td>
                    <td className="py-2.5 pr-3">
                      <Input
                        type="number"
                        className="w-32 py-1.5"
                        defaultValue={item.price}
                        placeholder="0"
                        onChange={(e) => setPrices((p) => ({ ...p, [item.id]: e.target.value }))}
                      />
                    </td>
                    <td className="py-2.5 pr-3">
                      <Button size="sm" variant="secondary" onClick={() => setRecipeItem(item)}>
                        <ChefHat className="size-3.5" />
                        Recipe
                      </Button>
                    </td>
                    <td className="py-2.5">
                      <Button size="sm" variant="danger" onClick={() => removeMenuItem.mutate(item.id)}>
                        <X className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
        <Button variant="primary" className="mt-4" onClick={handleSaveItems}>
          <Save className="size-4" />
          Save all changes
        </Button>
      </Card>

      <Card title="Team members">
        <div className="mb-3 grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
          <div>
            <Label>Name</Label>
            <Input value={newEmpName} onChange={(e) => setNewEmpName(e.target.value)} placeholder="e.g. Sara Ahmad" />
          </div>
          <div>
            <Label>Name (Arabic, optional)</Label>
            <Input value={newEmpNameAr} onChange={(e) => setNewEmpNameAr(e.target.value)} placeholder="سارة أحمد" />
          </div>
        </div>
        <Button
          variant="primary"
          className="mb-4"
          onClick={() => {
            if (!newEmpName.trim()) {
              toast.show('Enter a name');
              return;
            }
            createEmployee.mutate({ name: newEmpName.trim(), nameAr: newEmpNameAr.trim() || undefined });
          }}
        >
          <Plus className="size-4" />
          Add employee
        </Button>
        <div>
          {(employeesQuery.data ?? []).map((e) => (
            <div key={e.id} className="flex items-center justify-between border-b border-border py-2.5 last:border-b-0">
              <span className="text-sm font-medium text-ink">
                {e.name} {e.nameAr && <span className="text-muted">— {e.nameAr}</span>}
              </span>
              <Button size="sm" variant="danger" onClick={() => removeEmployee.mutate(e.id)}>
                Remove
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Tables">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="w-28">
            <Label>Table number</Label>
            <Input type="number" min={1} value={newTableNumber} onChange={(e) => setNewTableNumber(e.target.value)} placeholder="31" />
          </div>
          <div className="min-w-[160px]">
            <Label>Label (optional)</Label>
            <Input value={newTableLabel} onChange={(e) => setNewTableLabel(e.target.value)} placeholder="e.g. Patio 1" />
          </div>
          <Button
            variant="primary"
            onClick={() => {
              const n = parseInt(newTableNumber, 10);
              if (!Number.isFinite(n) || n <= 0) {
                toast.show('Enter a valid table number');
                return;
              }
              createTable.mutate({ number: n, label: newTableLabel.trim() || undefined });
            }}
          >
            <Plus className="size-4" />
            Add table
          </Button>
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2">
          {(tablesQuery.data ?? []).map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <span className="text-sm font-medium text-ink">
                T{t.number}
                {t.label && <span className="text-muted"> — {t.label}</span>}
              </span>
              <Button size="sm" variant="danger" onClick={() => setDeleteTableId(t.id)}>
                <X className="size-3.5" />
              </Button>
            </div>
          ))}
          {(tablesQuery.data ?? []).length === 0 && <div className="py-2 text-sm text-muted">No tables yet</div>}
        </div>
      </Card>

      <Card title="Stock categories">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[160px]">
            <Label>Name</Label>
            <Input value={newStockCatName} onChange={(e) => setNewStockCatName(e.target.value)} placeholder="e.g. Frozen goods" />
          </div>
          <Button
            variant="primary"
            onClick={() => {
              if (!newStockCatName.trim()) {
                toast.show('Enter a name');
                return;
              }
              createStockCategory.mutate(newStockCatName.trim());
            }}
          >
            <Plus className="size-4" />
            Add category
          </Button>
        </div>
        <div>
          {(stockCategoriesQuery.data ?? []).map((c) => (
            <div key={c.id} className="flex items-center justify-between border-b border-border py-2.5 last:border-b-0">
              <span className="text-sm font-medium text-ink">{c.name}</span>
              <Button size="sm" variant="danger" onClick={() => removeStockCategory.mutate(c.id)}>
                Remove
              </Button>
            </div>
          ))}
          {(stockCategoriesQuery.data ?? []).length === 0 && <div className="py-2 text-sm text-muted">No categories yet</div>}
        </div>
      </Card>

      <Card title="Units">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[160px]">
            <Label>Name</Label>
            <Input value={newUnitName} onChange={(e) => setNewUnitName(e.target.value)} placeholder="e.g. bottle" />
          </div>
          <Button
            variant="primary"
            onClick={() => {
              if (!newUnitName.trim()) {
                toast.show('Enter a name');
                return;
              }
              createUnit.mutate(newUnitName.trim());
            }}
          >
            <Plus className="size-4" />
            Add unit
          </Button>
        </div>
        <div>
          {(stockUnitsQuery.data ?? []).map((u) => (
            <div key={u.id} className="flex items-center justify-between border-b border-border py-2.5 last:border-b-0">
              <span className="text-sm font-medium text-ink">{u.name}</span>
              <Button size="sm" variant="danger" onClick={() => removeUnit.mutate(u.id)}>
                Remove
              </Button>
            </div>
          ))}
          {(stockUnitsQuery.data ?? []).length === 0 && <div className="py-2 text-sm text-muted">No units yet</div>}
        </div>
      </Card>

      <Card title="Discount presets">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[160px]">
            <Label>Name</Label>
            <Input value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder="e.g. Staff discount" />
          </div>
          <div className="w-28">
            <Label>Percent</Label>
            <Input type="number" value={presetPercent} onChange={(e) => setPresetPercent(e.target.value)} placeholder="10" />
          </div>
          <Button
            variant="primary"
            onClick={() => {
              if (!presetName.trim() || !presetPercent) {
                toast.show('Enter name and percent');
                return;
              }
              createPreset.mutate({ name: presetName.trim(), percent: parseFloat(presetPercent) });
            }}
          >
            <Plus className="size-4" />
            Add
          </Button>
        </div>
        <div>
          {(presetsQuery.data ?? []).map((p) => (
            <div key={p.id} className="flex items-center justify-between border-b border-border py-2.5 last:border-b-0">
              <span className="text-sm font-medium text-ink">
                {p.name} — {p.percent}%
              </span>
              <Button size="sm" variant="danger" onClick={() => removePreset.mutate(p.id)}>
                Remove
              </Button>
            </div>
          ))}
          {(presetsQuery.data ?? []).length === 0 && <div className="py-2 text-sm text-muted">No presets yet</div>}
        </div>
      </Card>

      <Card title="Team access">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[160px]">
            <Label>Username</Label>
            <Input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder="e.g. sara" />
          </div>
          <div className="min-w-[160px]">
            <Label>Password</Label>
            <Input type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} placeholder="min 6 characters" />
          </div>
          <div className="min-w-[120px]">
            <Label>Role</Label>
            <Select value={newUserRole} onChange={(e) => setNewUserRole(e.target.value as UserRole)}>
              <option value="STAFF">Staff</option>
              <option value="ADMIN">Admin</option>
            </Select>
          </div>
          <Button
            variant="primary"
            onClick={() => {
              if (!newUsername.trim() || newUserPassword.length < 6) {
                toast.show('Enter a username and a password (min 6 characters)');
                return;
              }
              createUserMutation.mutate();
            }}
          >
            <Plus className="size-4" />
            Add user
          </Button>
        </div>
        <div>
          {(usersQuery.data ?? []).map((u) => (
            <div key={u.id} className="flex items-center justify-between border-b border-border py-2.5 last:border-b-0">
              <span className="flex items-center gap-2 text-sm font-medium text-ink">
                {u.username}
                <Badge tone={u.role === 'ADMIN' ? 'amber' : 'gray'}>{u.role === 'ADMIN' ? 'Admin' : 'Staff'}</Badge>
                <Badge tone={u.active ? 'green' : 'gray'}>{u.active ? 'Active' : 'Disabled'}</Badge>
              </span>
              <div className="flex items-center gap-1.5">
                <Select
                  className="w-auto py-1.5 text-xs"
                  value={u.role}
                  onChange={(e) => changeUserRole.mutate({ id: u.id, role: e.target.value as UserRole })}
                >
                  <option value="STAFF">Staff</option>
                  <option value="ADMIN">Admin</option>
                </Select>
                <Button size="sm" variant="secondary" onClick={() => toggleUserActive.mutate({ id: u.id, active: !u.active })}>
                  {u.active ? 'Disable' : 'Enable'}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setResetPasswordUserId(u.id)}>
                  <KeyRound className="size-3.5" />
                </Button>
                <Button size="sm" variant="danger" onClick={() => setDeleteUserId(u.id)}>
                  <X className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
          {(usersQuery.data ?? []).length === 0 && <div className="py-2 text-sm text-muted">No users yet</div>}
        </div>
      </Card>

      <Card title="Security">
        <div className="flex items-center justify-between border-b border-border py-3.5 first:pt-0">
          <div className="text-sm font-medium text-ink">Change password</div>
          <Button variant="secondary" onClick={() => setPwModalOpen(true)}>
            <KeyRound className="size-4" />
            Change
          </Button>
        </div>
        <div className="flex items-center justify-between py-3.5 last:pb-0">
          <div className="text-sm font-medium text-ink">Lock this session</div>
          <Button variant="dark" onClick={logout}>
            <Lock className="size-4" />
            Lock
          </Button>
        </div>
      </Card>

      <Card title="Import legacy sales">
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-info-light px-4 py-3 text-[13px] font-medium text-info">
          <Info className="size-4 shrink-0" />
          Upload a daily cash-register statement (.xls/.xlsx) from the old system. Each invoice row becomes a PAID
          order dated from the sheet, matched to the table number, and marked CASH. Re-uploading the same file is
          safe — already-imported invoices are skipped automatically.
        </div>
        <label className="flex w-fit cursor-pointer items-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-white hover:bg-ink/90">
          <Upload className="size-4" />
          {importSalesMutation.isPending ? 'Uploading…' : 'Choose file to import'}
          <input
            type="file"
            accept=".xls,.xlsx"
            className="hidden"
            disabled={importSalesMutation.isPending}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) importSalesMutation.mutate(file);
              e.target.value = '';
            }}
          />
        </label>
        {importResult && (
          <div className="mt-4 rounded-xl border border-border bg-bg p-4 text-sm">
            <div className="font-medium text-ink">
              Imported {importResult.imported}, already had {importResult.alreadyImported}, skipped {importResult.skipped}
            </div>
            {importResult.skippedDetails.length > 0 && (
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-muted">
                {importResult.skippedDetails.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>

      <Card title="Danger zone">
        <div className="flex items-center justify-between border-b border-border py-3.5 first:pt-0">
          <div className="text-sm font-medium text-ink">Clear all sales</div>
          <Button variant="danger" onClick={() => setDangerAction('sales')}>
            <Trash2 className="size-4" />
            Clear
          </Button>
        </div>
        <div className="flex items-center justify-between border-b border-border py-3.5">
          <div className="text-sm font-medium text-ink">Clear employee log</div>
          <Button variant="danger" onClick={() => setDangerAction('emp')}>
            <Trash2 className="size-4" />
            Clear
          </Button>
        </div>
        <div className="flex items-center justify-between py-3.5 last:pb-0">
          <div className="text-sm font-medium text-ink">Full reset</div>
          <Button className="bg-danger text-white hover:bg-red-700" onClick={() => setDangerAction('reset')}>
            <AlertTriangle className="size-4" />
            Reset all
          </Button>
        </div>
      </Card>

      <RecipeEditorModal item={recipeItem} onClose={() => setRecipeItem(null)} />

      <ConfirmModal
        open={!!deleteTableId}
        onClose={() => setDeleteTableId(null)}
        onConfirm={() => deleteTableId && removeTable.mutate(deleteTableId)}
        title="Remove table?"
        message="This table will be removed. Tables with an open order can't be removed until it's cleared or paid."
        confirmLabel="Remove table"
        danger
      />

      <ConfirmModal
        open={!!deleteCatId}
        onClose={() => setDeleteCatId(null)}
        onConfirm={() => deleteCatId && removeMenuCategory.mutate(deleteCatId)}
        title="Remove category?"
        message="This permanently deletes the category and every menu item inside it. This cannot be undone."
        confirmLabel="Remove category"
        danger
      />

      <ConfirmModal
        open={!!deleteUserId}
        onClose={() => setDeleteUserId(null)}
        onConfirm={() => deleteUserId && removeUser.mutate(deleteUserId)}
        title="Remove user?"
        message="This account will no longer be able to log in."
        confirmLabel="Remove user"
        danger
      />

      <Modal open={!!resetPasswordUserId} onClose={() => setResetPasswordUserId(null)} title="Reset password">
        <div className="mb-5">
          <Label>New password (min 6 characters)</Label>
          <Input type="password" value={resetPasswordValue} onChange={(e) => setResetPasswordValue(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <Button
            variant="primary"
            className="flex-1"
            onClick={() => {
              if (resetPasswordValue.length < 6) {
                toast.show('Password must be at least 6 characters');
                return;
              }
              resetUserPasswordMutation.mutate();
            }}
          >
            Save
          </Button>
          <Button variant="secondary" onClick={() => setResetPasswordUserId(null)}>
            Cancel
          </Button>
        </div>
      </Modal>

      <Modal open={pwModalOpen} onClose={() => setPwModalOpen(false)} title="Change password">
        <div className="mb-3">
          <Label>Current password</Label>
          <Input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} />
        </div>
        <div className="mb-3">
          <Label>New password (min 6 characters)</Label>
          <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
        </div>
        <div className="mb-5">
          <Label>Confirm new password</Label>
          <Input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <Button variant="primary" className="flex-1" onClick={handleChangePassword}>
            Save
          </Button>
          <Button variant="secondary" onClick={() => setPwModalOpen(false)}>
            Cancel
          </Button>
        </div>
      </Modal>

      <ConfirmModal
        open={dangerAction === 'sales'}
        onClose={() => setDangerAction(null)}
        onConfirm={() => clearSales.mutate()}
        title="Clear all sales?"
        message="Every sale in the history will be permanently deleted. This cannot be undone."
        confirmLabel="Clear all sales"
        danger
        requireText="DELETE SALES"
      />
      <ConfirmModal
        open={dangerAction === 'emp'}
        onClose={() => setDangerAction(null)}
        onConfirm={() => clearEmpLog.mutate()}
        title="Clear employee log?"
        message="Every employee consumption log entry will be permanently deleted."
        confirmLabel="Clear log"
        danger
        requireText="DELETE LOG"
      />
      <ConfirmModal
        open={dangerAction === 'reset'}
        onClose={() => setDangerAction(null)}
        onConfirm={() => resetAll.mutate()}
        title="Full reset?"
        message="This wipes ALL sales, open orders, employee logs, and stock counts, and sets every stock item to 0. This cannot be undone."
        confirmLabel="Reset everything"
        danger
        requireText="RESET EVERYTHING"
      />
    </div>
  );
}
