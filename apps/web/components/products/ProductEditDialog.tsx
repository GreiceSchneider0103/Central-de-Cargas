'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { FieldGroup, Input, Select } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { createClient } from '@/lib/supabase/client';
import { translateError } from '@/lib/ui/error-messages';
import type { NamedOption, ProductRow } from '@/lib/products/types';
import { CompanyCheckboxes } from './CompanyCheckboxes';

type Draft = {
  sku: string;
  nome: string;
  cmv: string;
  preco_venda: string;
  fornecedor_id: string;
  ativo: boolean;
  peso: string;
  altura: string;
  largura: string;
  profundidade: string;
  company_ids: string[];
};

const str = (v: number | null | undefined) => (v == null ? '' : String(v));

function toDraft(p: ProductRow): Draft {
  return {
    sku: p.sku,
    nome: p.nome,
    cmv: str(p.cmv),
    preco_venda: str(p.preco_venda),
    fornecedor_id: p.fornecedor_id ?? '',
    ativo: p.ativo,
    peso: str(p.peso),
    altura: str(p.altura),
    largura: str(p.largura),
    profundidade: str(p.profundidade),
    company_ids: p.company_ids,
  };
}

export function ProductEditDialog({
  product,
  onClose,
  companies,
  suppliers,
}: {
  product: ProductRow | null;
  onClose: () => void;
  companies: NamedOption[];
  suppliers: NamedOption[];
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const router = useRouter();

  useEffect(() => {
    setDraft(product ? toDraft(product) : null);
  }, [product]);

  if (!product || !draft) return null;

  const set = <K extends keyof Draft>(field: K, value: Draft[K]) => setDraft((prev) => (prev ? { ...prev, [field]: value } : prev));

  async function save() {
    if (!draft) return;
    setSaving(true);
    const { error } = await createClient().rpc('update_product', {
      p_id: product!.id,
      p_patch: {
        sku: draft.sku,
        nome: draft.nome,
        cmv: draft.cmv,
        preco_venda: draft.preco_venda,
        fornecedor_id: draft.fornecedor_id,
        ativo: draft.ativo,
        peso: draft.peso,
        altura: draft.altura,
        largura: draft.largura,
        profundidade: draft.profundidade,
        company_ids: draft.company_ids,
      },
    });
    setSaving(false);
    if (error) return toast.error(translateError(error.message, 'Erro ao salvar o produto.'));
    toast.success('Produto atualizado.');
    onClose();
    router.refresh();
  }

  return (
    <Dialog
      open
      onClose={() => !saving && onClose()}
      title="Editar produto"
      description={product.sku}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="primary" onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <FieldGroup label="SKU">
          <Input value={draft.sku} onChange={(e) => set('sku', e.target.value)} />
        </FieldGroup>
        <FieldGroup label="Nome" className="md:col-span-3">
          <Input value={draft.nome} onChange={(e) => set('nome', e.target.value)} />
        </FieldGroup>
        <FieldGroup label="CMV (R$)">
          <Input type="number" step="0.01" value={draft.cmv} onChange={(e) => set('cmv', e.target.value)} />
        </FieldGroup>
        <FieldGroup label="Preço de venda (R$)">
          <Input type="number" step="0.01" value={draft.preco_venda} onChange={(e) => set('preco_venda', e.target.value)} />
        </FieldGroup>
        <FieldGroup label="Fornecedor / fabricante">
          <Select value={draft.fornecedor_id} onChange={(e) => set('fornecedor_id', e.target.value)}>
            <option value="">Sem fornecedor</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </Select>
        </FieldGroup>
        <FieldGroup label="Status">
          <Select value={draft.ativo ? 'true' : 'false'} onChange={(e) => set('ativo', e.target.value === 'true')}>
            <option value="true">Ativo</option>
            <option value="false">Inativo</option>
          </Select>
        </FieldGroup>
        <FieldGroup label="Peso (kg)">
          <Input type="number" step="0.01" value={draft.peso} onChange={(e) => set('peso', e.target.value)} />
        </FieldGroup>
        <FieldGroup label="Largura (cm)">
          <Input type="number" step="0.1" value={draft.largura} onChange={(e) => set('largura', e.target.value)} />
        </FieldGroup>
        <FieldGroup label="Altura (cm)">
          <Input type="number" step="0.1" value={draft.altura} onChange={(e) => set('altura', e.target.value)} />
        </FieldGroup>
        <FieldGroup label="Profundidade / comprimento (cm)">
          <Input type="number" step="0.1" value={draft.profundidade} onChange={(e) => set('profundidade', e.target.value)} />
        </FieldGroup>
        <FieldGroup label="Empresas" className="md:col-span-4">
          <CompanyCheckboxes companies={companies} value={draft.company_ids} onChange={(ids) => set('company_ids', ids)} />
        </FieldGroup>
      </div>
    </Dialog>
  );
}
