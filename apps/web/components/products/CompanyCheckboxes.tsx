'use client';

import type { NamedOption } from '@/lib/products/types';

export function CompanyCheckboxes({
  companies,
  value,
  onChange,
  disabled,
}: {
  companies: NamedOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((c) => c !== id) : [...value, id]);
  const allSelected = companies.length > 0 && value.length === companies.length;

  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-1 gap-1 rounded-lg border border-zinc-300 p-2 sm:grid-cols-2 md:grid-cols-3">
        {companies.map((c) => (
          <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-800 hover:bg-zinc-50">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-zinc-300 accent-brand-600"
              checked={value.includes(c.id)}
              onChange={() => toggle(c.id)}
              disabled={disabled}
            />
            {c.nome}
          </label>
        ))}
      </div>
      {companies.length > 1 && (
        <button
          type="button"
          className="self-start text-xs font-medium text-brand-600 hover:underline disabled:opacity-50"
          disabled={disabled}
          onClick={() => onChange(allSelected ? [] : companies.map((c) => c.id))}
        >
          {allSelected ? 'Desmarcar todas' : 'Marcar todas'}
        </button>
      )}
    </div>
  );
}
