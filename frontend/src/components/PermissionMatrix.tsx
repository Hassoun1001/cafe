import type { PermissionDefDto } from '../types';

// Renders the permission catalog as a checkbox grid, grouped by area (Menu,
// Stock, Sales, …) — used both when adding a new STAFF user and when editing
// an existing one's grant list, in Settings and Study Settings alike.
export function PermissionMatrix({
  catalog,
  selected,
  onChange,
  disabled,
}: {
  catalog: PermissionDefDto[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const groups = new Map<string, PermissionDefDto[]>();
  for (const p of catalog) {
    const list = groups.get(p.group) ?? [];
    list.push(p);
    groups.set(p.group, list);
  }

  function toggle(key: string) {
    onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {[...groups.entries()].map(([group, perms]) => (
        <div key={group} className="rounded-lg border border-border p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-2">{group}</div>
          <div className="space-y-1.5">
            {perms.map((p) => (
              <label key={p.key} className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={selected.includes(p.key)}
                  onChange={() => toggle(p.key)}
                  className="size-4 shrink-0 rounded border-border"
                />
                {p.label}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
