'use client';

import { useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { FieldGroup, Input, Textarea } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { createClient } from '@/lib/supabase/client';
import { translateError } from '@/lib/ui/error-messages';
import { parseItemsText, parseItemsWorkbook, type SkuQuantity } from '@/lib/products/item-list';
import type { NewLoadItem } from './NewLoadItemsEditor';

type Resolved = { items: NewLoadItem[]; notFound: string[]; outsideCompany: string[] };

// Adiciona muitos itens de uma vez: colando "SKU  quantidade" (uma linha por
// item, copiado do Excel) ou enviando uma planilha com colunas SKU e
// Quantidade. Os nomes vêm do cadastro de produtos.
export function ItemsBulkAddDialog({
  open,
  onClose,
  onAdd,
  companyId,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (items: NewLoadItem[]) => void;
  companyId: string | null | undefined;
}) {
  const [text, setText] = useState('');
  const [fileKey, setFileKey] = useState(0);
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  function close() {
    setText('');
    setResolved(null);
    setFileKey((k) => k + 1);
    onClose();
  }

  async function resolve(entries: SkuQuantity[]) {
    if (entries.length === 0) {
      toast.error('Nenhum SKU com quantidade encontrado.');
      return;
    }
    setBusy(true);
    const skus = Array.from(new Set(entries.map((e) => e.sku)));
    const { data, error } = await createClient().rpc('get_visible_products_by_skus', { p_skus: skus, p_company_id: companyId || null });
    setBusy(false);
    if (error) return toast.error(translateError(error.message, 'Erro ao buscar os produtos.'));

    const bySku = new Map(
      ((data ?? []) as { sku: string; nome: string; preco_venda: number | null; in_company: boolean }[]).map((p) => [p.sku, p]),
    );
    const quantities = new Map<string, number>();
    for (const e of entries) quantities.set(e.sku, (quantities.get(e.sku) ?? 0) + e.quantidade);

    const items: NewLoadItem[] = [];
    const notFound: string[] = [];
    const outsideCompany: string[] = [];
    for (const [sku, quantidade] of quantities) {
      const product = bySku.get(sku);
      if (!product) {
        notFound.push(sku);
        continue;
      }
      if (!product.in_company) outsideCompany.push(sku);
      items.push({ sku, nome_produto: product.nome, quantidade: String(quantidade), preco_venda: product.preco_venda });
    }
    setResolved({ items, notFound, outsideCompany });
  }

  async function handleFile(file: File | undefined) {
    setFileKey((k) => k + 1);
    if (!file) return;
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      await resolve(parseItemsWorkbook(workbook, XLSX.utils));
    } catch (error) {
      toast.error(translateError(error instanceof Error ? error.message : undefined, 'Não foi possível ler a planilha.'));
    }
  }

  function confirm() {
    if (!resolved || resolved.items.length === 0) return;
    onAdd(resolved.items);
    toast.success(`${resolved.items.length} itens adicionados.`);
    close();
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Adicionar itens em lote"
      description="Cole do Excel (SKU e quantidade, uma linha por item) ou envie uma planilha com as colunas SKU e Quantidade."
      footer={
        resolved ? (
          <>
            <Button variant="secondary" onClick={() => setResolved(null)}>Voltar</Button>
            <Button variant="primary" onClick={confirm} disabled={resolved.items.length === 0}>Adicionar {resolved.items.length} itens</Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={close}>Cancelar</Button>
            <Button variant="primary" onClick={() => resolve(parseItemsText(text))} disabled={busy || !text.trim()}>
              {busy ? 'Buscando...' : 'Conferir itens'}
            </Button>
          </>
        )
      }
    >
      {resolved ? (
        <div className="space-y-2 text-sm text-zinc-700">
          <p className="font-medium text-zinc-900">{resolved.items.length} produtos encontrados</p>
          {resolved.outsideCompany.length > 0 && (
            <p className="text-amber-700">
              {resolved.outsideCompany.length} não estão vinculados à empresa escolhida (serão adicionados mesmo assim): {resolved.outsideCompany.slice(0, 10).join(', ')}
              {resolved.outsideCompany.length > 10 ? '…' : ''}
            </p>
          )}
          {resolved.notFound.length > 0 && (
            <p className="text-rose-700">
              {resolved.notFound.length} SKUs não encontrados no cadastro (ficam de fora): {resolved.notFound.slice(0, 15).join(', ')}
              {resolved.notFound.length > 15 ? '…' : ''}
            </p>
          )}
          <p className="text-xs text-zinc-500">SKUs repetidos têm as quantidades somadas; se o SKU já estiver na lista, a quantidade é somada à existente.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <FieldGroup label="Colar lista">
            <Textarea
              className="min-h-[10rem] font-mono text-xs"
              placeholder={'3352648\t10\n36253695\t5\n1478625;2'}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </FieldGroup>
          <FieldGroup label="Ou enviar planilha">
            <Input key={fileKey} type="file" accept=".xls,.xlsx,.csv" className="h-auto py-2" disabled={busy} onChange={(e) => handleFile(e.target.files?.[0])} />
          </FieldGroup>
        </div>
      )}
    </Dialog>
  );
}
