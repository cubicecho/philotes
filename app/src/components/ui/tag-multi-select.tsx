import { Check, ChevronDown, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface TagOption {
  id: string;
  label: string;
  color: string;
}

interface TagMultiSelectProps {
  options: TagOption[];
  selected: string[]; // array of selected ids
  onChange: (ids: string[]) => void;
  placeholder?: string;
  id?: string;
}

export function TagMultiSelect({
  options,
  selected,
  onChange,
  placeholder = 'Select tags...',
  id,
}: TagMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()));

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  };

  const remove = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selected.filter((s) => s !== id));
  };

  const selectedOptions = options.filter((o) => selected.includes(o.id));

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        id={id}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex min-h-9 w-full flex-wrap items-center gap-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring',
          open && 'ring-2 ring-ring',
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selectedOptions.length === 0 ? (
          <span className="text-muted-foreground px-1">{placeholder}</span>
        ) : (
          selectedOptions.map((o) => (
            <span key={o.id} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
              <span
                className="inline-block h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: o.color }}
                aria-hidden="true"
              />
              {o.label}
              <button
                type="button"
                onClick={(e) => remove(o.id, e)}
                className="ml-0.5 text-muted-foreground hover:text-destructive transition-colors"
                aria-label={`Remove ${o.label}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))
        )}
        <ChevronDown
          className={cn('ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-background shadow-md">
          <div className="p-1.5">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full rounded-sm border-0 bg-muted px-2 py-1 text-sm focus:outline-none"
              // biome-ignore lint/a11y/noAutofocus: intentional for dropdown search
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">No tags found.</p>
            ) : (
              filtered.map((o) => {
                const isSelected = selected.includes(o.id);
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => toggle(o.id)}
                    className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted focus:bg-muted focus:outline-none"
                    aria-pressed={isSelected}
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: o.color }}
                      aria-hidden="true"
                    />
                    <span className="flex-1 text-left">{o.label}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
