import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import * as api from '../api/endpoints';
import { useToast } from '../lib/toast';
import { apiErrorMessage } from '../lib/api';
import { Button, Input, Label, Modal, Select } from './ui';
import type { MenuItemDto } from '../types';

export function RecipeEditorModal({ item, onClose }: { item: MenuItemDto | null; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [stockItemId, setStockItemId] = useState('');
  const [qtyPerUnit, setQtyPerUnit] = useState('');

  const stockQuery = useQuery({ queryKey: ['stock'], queryFn: api.getStock, enabled: !!item });
  const recipeQuery = useQuery({
    queryKey: ['recipe', item?.id],
    queryFn: () => api.getRecipe(item!.id),
    enabled: !!item,
  });

  const setIngredient = useMutation({
    mutationFn: (vars: { stockItemId: string; qtyPerUnit: number }) => api.setRecipeIngredient(item!.id, vars.stockItemId, vars.qtyPerUnit),
    onSuccess: (recipe) => {
      qc.setQueryData(['recipe', item?.id], recipe);
      setStockItemId('');
      setQtyPerUnit('');
      toast.show('Ingredient saved', 'success');
    },
    onError: (e) => toast.show(apiErrorMessage(e), 'error'),
  });

  const removeIngredient = useMutation({
    mutationFn: (sId: string) => api.removeRecipeIngredient(item!.id, sId),
    onSuccess: (recipe) => {
      qc.setQueryData(['recipe', item?.id], recipe);
      toast.show('Removed');
    },
    onError: (e) => toast.show(apiErrorMessage(e), 'error'),
  });

  if (!item) return null;
  const stock = stockQuery.data ?? [];
  const recipe = recipeQuery.data ?? [];
  const availableStock = stock.filter((s) => !recipe.some((r) => r.stockItemId === s.id));

  return (
    <Modal open={!!item} onClose={onClose} title={`Recipe — ${item.name}`} wide>
      <p className="mb-4 text-sm text-muted">
        How much of each stock item does one <strong>{item.name}</strong> consume? Selling this item will deduct these
        amounts automatically. Leave empty for items you don't want to track.
      </p>

      {recipe.length > 0 && (
        <div className="mb-4">
          {recipe.map((r) => (
            <div key={r.id} className="flex items-center justify-between border-b border-border py-2.5 last:border-b-0">
              <span className="text-sm font-medium text-ink">
                {r.qtyPerUnit} {r.unit} {r.stockItemName}
              </span>
              <Button size="sm" variant="danger" onClick={() => removeIngredient.mutate(r.stockItemId)}>
                <X className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[160px] flex-1">
          <Label>Stock item</Label>
          <Select value={stockItemId} onChange={(e) => setStockItemId(e.target.value)}>
            <option value="">Select…</option>
            {availableStock.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.unit})
              </option>
            ))}
          </Select>
        </div>
        <div className="w-28">
          <Label>Qty per unit</Label>
          <Input type="number" min={0} step="any" value={qtyPerUnit} onChange={(e) => setQtyPerUnit(e.target.value)} placeholder="0.02" />
        </div>
        <Button
          variant="primary"
          onClick={() => {
            const qty = parseFloat(qtyPerUnit);
            if (!stockItemId || !Number.isFinite(qty) || qty <= 0) {
              toast.show('Pick a stock item and a quantity');
              return;
            }
            setIngredient.mutate({ stockItemId, qtyPerUnit: qty });
          }}
        >
          <Plus className="size-4" />
          Add
        </Button>
      </div>

      <Button variant="secondary" className="mt-5 w-full" onClick={onClose}>
        Done
      </Button>
    </Modal>
  );
}
