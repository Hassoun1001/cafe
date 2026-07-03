import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import clsx from 'clsx';

export interface SearchableSelectItem {
  id: string;
  label: string;
  sublabel?: string | null;
}

interface SearchableSelectProps {
  items: SearchableSelectItem[];
  value: string | null;
  onChange: (id: string) => void;
  placeholder?: string;
}

// A text input + dropdown combobox: type to filter (matches label OR
// sublabel, so an Arabic name is just as searchable as the English one),
// click an option to select. Plain HTML <select> doesn't support this kind
// of typeahead search well for a 50+ item menu list.
export function SearchableSelect({ items, value, onChange, placeholder }: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = items.find((i) => i.id === value) ?? null;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.label.toLowerCase().includes(q) || (i.sublabel ?? '').toLowerCase().includes(q));
  }, [items, query]);

  const displayValue = open ? query : (selected?.label ?? '');

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-2" />
        <input
          className="w-full rounded-lg border border-border bg-surface py-2.5 pl-9 pr-8 text-sm text-ink outline-none transition-all placeholder:text-muted-2 focus:border-accent focus:ring-4 focus:ring-accent/15"
          placeholder={placeholder}
          value={displayValue}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
        />
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-2" />
      </div>
      {open && (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-surface shadow-[var(--shadow-elevated)]">
          {filtered.length === 0 && <div className="px-3 py-2.5 text-sm text-muted">No matches</div>}
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onChange(item.id);
                setOpen(false);
                setQuery('');
              }}
              className={clsx(
                'flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-bg',
                item.id === value && 'bg-accent-light',
              )}
            >
              <span className="font-medium text-ink">{item.label}</span>
              {item.sublabel && (
                <span dir="rtl" lang="ar" className="text-xs text-muted">
                  {item.sublabel}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
