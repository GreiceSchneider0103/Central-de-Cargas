'use client';

import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { translateError } from '@/lib/ui/error-messages';
import type { NamedOption } from '@/lib/products/types';

export type ProductSyncProposal = {
  productId: string;
  sku: string;
  patch: { cmv?: number; fornecedor_id?: string };
  changes: string[];
};

const money = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Compara o CMV e o fornecedor digitados no item com o cadastro do produto.
// Devolve a proposta de atualização, ou null se não há diferença (ou se o SKU
// não é de um produto cadastrado).
export async function findProductChanges(
  supabase: SupabaseClient,
  item: { sku?: string | number | null; cmv_unitario?: string | number | null; fornecedor_origem_id?: string | number | null },
  suppliers: NamedOption[],
): Promise<ProductSyncProposal | null> {
  const sku = String(item.sku ?? '').trim();
  if (!sku) return null;

  const { data } = await supabase.rpc('get_visible_product_by_sku', { p_sku: sku });
  const product = (Array.isArray(data) ? data[0] : null) as { id: string; cmv: number | null; fornecedor_id: string | null } | null;
  if (!product) return null;

  const patch: ProductSyncProposal['patch'] = {};
  const changes: string[] = [];

  const cmv = Number(item.cmv_unitario ?? 0);
  const currentCmv = Number(product.cmv ?? 0);
  if (cmv > 0 && Math.abs(cmv - currentCmv) >= 0.005) {
    patch.cmv = cmv;
    changes.push(`CMV: ${currentCmv > 0 ? money(currentCmv) : 'sem CMV'} → ${money(cmv)}`);
  }

  const fornecedor = String(item.fornecedor_origem_id ?? '');
  if (fornecedor && fornecedor !== (product.fornecedor_id ?? '')) {
    const name = (id: string | null) => suppliers.find((s) => s.id === id)?.nome ?? 'sem fornecedor';
    patch.fornecedor_id = fornecedor;
    changes.push(`Fornecedor: ${name(product.fornecedor_id)} → ${name(fornecedor)}`);
  }

  return changes.length > 0 ? { productId: product.id, sku, patch, changes } : null;
}

export function ProductSyncPrompt({
  proposal,
  onClose,
  supabase,
}: {
  proposal: ProductSyncProposal | null;
  onClose: () => void;
  supabase: SupabaseClient;
}) {
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  if (!proposal) return null;

  async function save() {
    if (!proposal) return;
    setSaving(true);
    const { error } = await supabase.rpc('update_product', { p_id: proposal.productId, p_patch: proposal.patch });
    setSaving(false);
    if (error) return toast.error(translateError(error.message, 'Erro ao atualizar o produto.'));
    toast.success(`Cadastro do SKU ${proposal.sku} atualizado.`);
    onClose();
  }

  return (
    <Dialog
      open
      onClose={() => !saving && onClose()}
      title="Salvar no cadastro do produto?"
      description={`SKU ${proposal.sku}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Só nesta carga</Button>
          <Button variant="primary" onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar no produto'}</Button>
        </>
      }
    >
      <p className="text-sm text-zinc-600">O item foi salvo com dados diferentes do cadastro do produto:</p>
      <ul className="mt-2 space-y-1 text-sm text-zinc-800">
        {proposal.changes.map((c) => <li key={c}>• {c}</li>)}
      </ul>
      <p className="mt-2 text-xs text-zinc-500">Se salvar, as próximas cargas com esse SKU já vêm com esses dados.</p>
    </Dialog>
  );
}
