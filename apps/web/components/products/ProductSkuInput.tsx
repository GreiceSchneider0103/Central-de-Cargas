'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/Field';

export type ProductSuggestion = { id: string; sku: string; nome: string; cmv: number | null };

// Campo de SKU com sugestões dos produtos vinculados à empresa (busca por SKU
// ou nome). Sem empresa selecionada, funciona como um campo de texto comum.
export function ProductSkuInput({
  value,
  companyId,
  onChange,
  onSelect,
}: {
  value: string;
  companyId: string | null | undefined;
  onChange: (sku: string) => void;
  onSelect: (product: ProductSuggestion) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [searched, setSearched] = useState(false);
  const typed = useRef(false);

  useEffect(() => {
    const term = value.trim();
    if (!typed.current || !companyId || term.length < 2) {
      setSuggestions([]);
      setSearched(false);
      return;
    }
    let cancelled = false;
    const timeout = setTimeout(async () => {
      const { data } = await supabase.rpc('get_visible_products_page', {
        p_page: 1,
        p_page_size: 8,
        p_search: term,
        p_company_id: companyId,
      });
      if (cancelled) return;
      setSuggestions(((data ?? []) as ProductSuggestion[]).map((p) => ({ id: p.id, sku: p.sku, nome: p.nome, cmv: p.cmv })));
      setSearched(true);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [value, companyId, supabase]);

  return (
    <div className="relative">
      <Input
        value={value}
        placeholder={companyId ? 'SKU ou nome' : 'Selecione a empresa para buscar'}
        onChange={(e) => {
          typed.current = true;
          setOpen(true);
          onChange(e.target.value);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && companyId && searched && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full min-w-[18rem] overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 text-sm shadow-popover">
          {suggestions.length === 0 ? (
            <li className="px-3 py-2 text-zinc-500">Nenhum produto desta empresa encontrado.</li>
          ) : (
            suggestions.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left hover:bg-zinc-50"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    typed.current = false;
                    setOpen(false);
                    setSuggestions([]);
                    onSelect(p);
                  }}
                >
                  <span className="font-mono text-xs text-zinc-500">{p.sku}</span>
                  <span className="block text-zinc-800">{p.nome}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
