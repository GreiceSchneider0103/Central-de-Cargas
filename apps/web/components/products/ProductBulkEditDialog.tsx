'use client';

import { useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { FieldGroup, Input, Select } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { createClient } from '@/lib/supabase/client';
import { translateError } from '@/lib/ui/error-messages';
import type { NamedOption } from '@/lib/products/types';
import { CompanyCheckboxes } from './CompanyCheckboxes';

const KEEP = '__keep__';

export function ProductBulkEditDialog({
  ids,
  onClose,
  onDone,
  companies,
  suppliers,
}: {
  ids: string[] | null;
  onClose: () => void;
  onDone: () => void;
  companies: NamedOption[];
  suppliers: NamedOption[];
}) {
  const [fornecedor, setFornecedor] = useState(KEEP);
  const [ativo, setAtivo] = useState(KEEP);
  const [cmv, setCmv] = useState('');
  const [addCompanies, setAddCompanies] = useState<string[]>([]);
  const [removeCompanies, setRemoveCompanies] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  if (!ids) return null;

  function close() {
    if (saving) return;
    setFornecedor(KEEP);
    setAtivo(KEEP);
    setCmv('');
    setAddCompanies([]);
    setRemoveCompanies([]);
    onClose();
  }

  const patch: Record<string, unknown> = {};
  if (fornecedor !== KEEP) patch.fornecedor_id = fornecedor;
  if (ativo !== KEEP) patch.ativo = ativo === 'true';
  if (cmv.trim() !== '') patch.cmv = cmv;
  if (addCompanies.length > 0) patch.add_company_ids = addCompanies;
  if (removeCompanies.length > 0) patch.remove_company_ids = removeCompanies;
  const hasChanges = Object.keys(patch).length > 0;

  async function save() {
    if (!ids || !hasChanges) return;
    setSaving(true);
    const { data, error } = await createClient().rpc('bulk_update_products', { p_ids: ids, p_patch: patch });
    setSaving(false);
    if (error) return toast.error(translateError(error.message, 'Erro ao editar os produtos.'));
    toast.success(`${Number(data ?? 0)} produtos atualizados.`);
    close();
    onDone();
  }

  return (
    <Dialog
      open
      onClose={close}
      title={`Editar ${ids.length} produtos`}
      description="Só os campos preenchidos são alterados; o resto fica como está."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={saving}>Cancelar</Button>
          <Button variant="primary" onClick={save} disabled={saving || !hasChanges}>{saving ? 'Salvando...' : 'Aplicar'}</Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <FieldGroup label="Fornecedor">
          <Select value={fornecedor} onChange={(e) => setFornecedor(e.target.value)}>
            <option value={KEEP}>Não alterar</option>
            <option value="">Sem fornecedor</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </Select>
        </FieldGroup>
        <FieldGroup label="CMV (R$)">
          <Input type="number" step="0.01" placeholder="Não alterar" value={cmv} onChange={(e) => setCmv(e.target.value)} />
        </FieldGroup>
        <FieldGroup label="Status">
          <Select value={ativo} onChange={(e) => setAtivo(e.target.value)}>
            <option value={KEEP}>Não alterar</option>
            <option value="true">Ativo</option>
            <option value="false">Inativo</option>
          </Select>
        </FieldGroup>
        <FieldGroup label="Adicionar às empresas" className="md:col-span-3">
          <CompanyCheckboxes companies={companies} value={addCompanies} onChange={setAddCompanies} disabled={saving} />
        </FieldGroup>
        <FieldGroup label="Remover das empresas" className="md:col-span-3">
          <CompanyCheckboxes companies={companies} value={removeCompanies} onChange={setRemoveCompanies} disabled={saving} />
        </FieldGroup>
      </div>
    </Dialog>
  );
}
