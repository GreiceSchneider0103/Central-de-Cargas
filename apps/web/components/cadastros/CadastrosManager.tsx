'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { UserProfileRole } from '@/lib/auth/roles';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, FieldGroup } from '@/components/ui/Field';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';

type BaseRow = {
  id: string;
  nome: string;
  ativo: boolean;
};

function isBaseRow(value: unknown): value is BaseRow {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === 'string' && typeof row.nome === 'string' && typeof row.ativo === 'boolean';
}

type Section = {
  key: string;
  label: string;
  table: string;
  fields: { key: string; label: string; required?: boolean }[];
};

const sections: Section[] = [
  { key: 'companies', label: 'Empresas', table: 'companies', fields: [{ key: 'nome', label: 'Nome', required: true }, { key: 'cnpj', label: 'CNPJ' }] },
  { key: 'distribution_centers', label: 'CDs', table: 'distribution_centers', fields: [{ key: 'nome', label: 'Nome', required: true }] },
  { key: 'stores', label: 'Lojas', table: 'stores', fields: [{ key: 'nome', label: 'Nome', required: true }] },
  { key: 'suppliers', label: 'Fornecedores', table: 'suppliers', fields: [{ key: 'nome', label: 'Nome', required: true }, { key: 'cnpj', label: 'CNPJ' }, { key: 'telefone', label: 'Telefone' }, { key: 'contato_nome', label: 'Contato' }] },
  { key: 'channels', label: 'Canais', table: 'channels', fields: [{ key: 'nome', label: 'Nome', required: true }, { key: 'tipo', label: 'Tipo', required: true }] },
  { key: 'full_destinations', label: 'Destinos Full', table: 'full_destinations', fields: [{ key: 'nome', label: 'Nome', required: true }, { key: 'marketplace_id', label: 'Marketplace ID' }, { key: 'endereco', label: 'Endereço' }, { key: 'codigo_agendamento_padrao', label: 'Código Agenda' }] },
  { key: 'transport_types', label: 'Transportes', table: 'transport_types', fields: [{ key: 'nome', label: 'Nome', required: true }, { key: 'tipo', label: 'Tipo', required: true }] },
];

export function CadastrosManager({ role }: { role: UserProfileRole }) {
  const [activeSection, setActiveSection] = useState<Section>(sections[0]);
  const [rows, setRows] = useState<BaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const toast = useToast();

  const canManage = role === 'admin' || role === 'gerente_estoque';

  const baseSelect = useMemo(() => 'id,nome,ativo,created_at,updated_at,cnpj,telefone,contato_nome,tipo,marketplace_id,endereco,codigo_agendamento_padrao', []);

  const loadData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const query = supabase.from(activeSection.table).select(baseSelect).order('nome', { ascending: true }).limit(100);
    if (!showInactive) query.eq('ativo', true);
    const { data, error } = await query;
    if (error) {
      setLoadError(error.message);
      setLoading(false);
      return;
    }
    const sourceRows: unknown[] = Array.isArray(data) ? [...data] : [];
    const normalizedRows = sourceRows.filter(isBaseRow);
    setRows(normalizedRows);
    setLoadError(null);
    setLoading(false);
  }, [activeSection.table, baseSelect, showInactive]);

  useEffect(() => {
    loadData();
    setForm({});
  }, [activeSection, showInactive, loadData]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    const payload = { ...form, ativo: true };
    const supabase = createClient();
    const { error } = await supabase.from(activeSection.table).insert(payload);
    if (error) {
      toast.error(error.message);
      return;
    }
    setForm({});
    toast.success('Cadastro salvo.');
    await loadData();
  }

  async function toggleActive(row: BaseRow) {
    if (!canManage) return;
    const supabase = createClient();
    const { error } = await supabase.from(activeSection.table).update({ ativo: !row.ativo }).eq('id', row.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await loadData();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {sections.map((section) => (
          <button
            key={section.key}
            onClick={() => setActiveSection(section)}
            className={cn('rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors', activeSection.key === section.key ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50')}
          >
            {section.label}
          </button>
        ))}
      </div>

      <Card>
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-zinc-900">{activeSection.label}</h2>
            <label className="flex items-center gap-2 text-sm text-zinc-600">
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
              Mostrar inativos
            </label>
          </div>

          {canManage && (
            <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 rounded-lg border border-dashed border-zinc-200 p-3 md:grid-cols-4">
              {activeSection.fields.map((field) => (
                <FieldGroup key={field.key} label={field.label}>
                  <Input
                    required={field.required}
                    value={form[field.key] ?? ''}
                    onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  />
                </FieldGroup>
              ))}
              <div className="flex items-end">
                <Button type="submit" variant="primary">Salvar</Button>
              </div>
            </form>
          )}

          {loading ? (
            <SkeletonRows rows={5} />
          ) : loadError ? (
            <EmptyState title="Não foi possível carregar" description={loadError} />
          ) : rows.length === 0 ? (
            <EmptyState title="Nada cadastrado ainda" description={canManage ? 'Use o formulário acima para cadastrar o primeiro registro.' : 'Nenhum registro disponível.'} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-left text-xs font-medium text-zinc-500">
                    <th className="py-2">Nome</th>
                    <th className="py-2">Status</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-zinc-50 last:border-0">
                      <td className="py-2 font-medium text-zinc-800">{row.nome}</td>
                      <td className="py-2"><Badge tone={row.ativo ? 'success' : 'neutral'} dot>{row.ativo ? 'Ativo' : 'Inativo'}</Badge></td>
                      <td className="py-2 text-right">
                        {canManage ? (
                          <button className="font-medium text-brand-600 hover:text-brand-700" onClick={() => toggleActive(row)}>
                            {row.ativo ? 'Inativar' : 'Ativar'}
                          </button>
                        ) : (
                          <span className="text-zinc-400">Somente leitura</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
