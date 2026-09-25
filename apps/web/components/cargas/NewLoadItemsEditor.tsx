'use client';

import { useState } from 'react';
import { ClipboardPaste, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { ProductSkuInput } from '@/components/products/ProductSkuInput';
import { ItemsBulkAddDialog } from './ItemsBulkAddDialog';

// Itens da nova carga: só SKU, nome e quantidade. O resto (CMV, fornecedor,
// peso, medidas, datas) vem do cadastro do produto ou é preenchido depois,
// no detalhe da carga. preco_venda fica só na tela, para sugerir o
// faturamento estimado.
export type NewLoadItem = {
  sku: string;
  nome_produto: string;
  quantidade: string;
  preco_venda: number | null;
};

export const EMPTY_NEW_LOAD_ITEM: NewLoadItem = { sku: '', nome_produto: '', quantidade: '1', preco_venda: null };

// Junta itens novos à lista: SKU que já existe soma a quantidade; linhas
// vazias são descartadas.
export function mergeNewLoadItems(current: NewLoadItem[], added: NewLoadItem[]) {
  const result = current.filter((i) => i.sku.trim() || i.nome_produto.trim()).map((i) => ({ ...i }));
  for (const item of added) {
    const existing = result.find((i) => i.sku.trim() === item.sku);
    if (existing) {
      existing.quantidade = String(Number(existing.quantidade || 0) + Number(item.quantidade || 0));
      if (!existing.nome_produto) existing.nome_produto = item.nome_produto;
      if (existing.preco_venda == null) existing.preco_venda = item.preco_venda;
    } else {
      result.push(item);
    }
  }
  return result.length > 0 ? result : [EMPTY_NEW_LOAD_ITEM];
}

export function newLoadItemsRevenue(items: NewLoadItem[]) {
  return items.reduce((sum, i) => sum + (i.preco_venda ?? 0) * Number(i.quantidade || 0), 0);
}

export function NewLoadItemsEditor({
  items,
  onChange,
  companyId,
}: {
  items: NewLoadItem[];
  onChange: (items: NewLoadItem[]) => void;
  companyId: string | null | undefined;
}) {
  const [bulkOpen, setBulkOpen] = useState(false);
  const filled = items.filter((i) => i.sku.trim());
  const totalQuantity = filled.reduce((sum, i) => sum + Number(i.quantidade || 0), 0);
  const update = (index: number, patch: Partial<NewLoadItem>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  return (
    <div className="space-y-2">
      <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,4fr)_minmax(0,1fr)_2.5rem] gap-2 text-xs font-medium text-zinc-600 md:grid">
        <span>SKU</span>
        <span>Nome do produto</span>
        <span>Quantidade</span>
        <span />
      </div>
      {items.map((item, index) => (
        <div key={index} className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,2fr)_minmax(0,4fr)_minmax(0,1fr)_2.5rem]">
          <ProductSkuInput
            value={item.sku}
            companyId={companyId}
            // Digitar o SKU à mão descarta o preço do produto escolhido antes.
            onChange={(sku) => update(index, { sku, preco_venda: null })}
            onSelect={(product) => update(index, { sku: product.sku, nome_produto: product.nome, preco_venda: product.preco_venda })}
          />
          <Input
            placeholder="Nome do produto"
            value={item.nome_produto}
            onChange={(e) => update(index, { nome_produto: e.target.value })}
          />
          <Input
            type="number"
            min="1"
            aria-label="Quantidade"
            value={item.quantidade}
            onChange={(e) => update(index, { quantidade: e.target.value })}
          />
          <button
            type="button"
            aria-label="Remover item"
            className="flex h-10 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-rose-600 disabled:opacity-30"
            disabled={items.length === 1}
            onClick={() => onChange(items.filter((_, i) => i !== index))}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => onChange([...items, EMPTY_NEW_LOAD_ITEM])}>
          <Plus className="h-3.5 w-3.5" />
          Adicionar item
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setBulkOpen(true)}>
          <ClipboardPaste className="h-3.5 w-3.5" />
          Colar lista / planilha
        </Button>
        {filled.length > 0 && (
          <span className="ml-auto text-xs text-zinc-500">
            {filled.length} {filled.length === 1 ? 'item' : 'itens'} · {totalQuantity.toLocaleString('pt-BR')} unidades
          </span>
        )}
      </div>
      <ItemsBulkAddDialog open={bulkOpen} onClose={() => setBulkOpen(false)} companyId={companyId} onAdd={(added) => onChange(mergeNewLoadItems(items, added))} />
    </div>
  );
}
