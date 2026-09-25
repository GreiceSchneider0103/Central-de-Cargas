'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Power, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { UserProfileRole } from '@/lib/auth/roles';
import { Card, CardBody } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input, Select, FieldGroup } from '@/components/ui/Field';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';

type BaseRow = {
  id: string;
  nome: string;
  ativo: boolean;
} & Record<string, unknown>;

function isBaseRow(value: unknown): value is BaseRow {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === 'string' && typeof row.nome === 'string' && typeof row.ativo === 'boolean';
}

type Field = { key: string; label: string; required?: boolean; kind?: 'text' | 'marketplace-select' };

type Section = {
  key: string;
  label: string;
  // Singular, para "Novo fornecedor" / "Editar fornecedor".
  singular: string;
  table: string;
  fields: Field[];
  // Mostra quantos produtos usam o cadastro (só fornecedores).
  productCount?: boolean;
};

const sections: Section[] = [
  { key: 'companies', label: 'Empresas', singular: 'empresa', table: 'companies', fields: [{ key: 'nome', label: 'Nome', required: true }, { key: 'cnpj', label: 'CNPJ' }] },
  { key: 'distribution_centers', label: 'CDs', singular: 'CD', table: 'distribution_centers', fields: [{ key: 'nome', label: 'Nome', required: true }] },
  { key: 'stores', label: 'Lojas', singular: 'loja', table: 'stores', fields: [{ key: 'nome', label: 'Nome', required: true }] },
  { key: 'suppliers', label: 'Fornecedores', singular: 'fornecedor', table: 'suppliers', productCount: true, fields: [{ key: 'nome', label: 'Nome', required: true }, { key: 'cnpj', label: 'CNPJ' }, { key: 'telefone', label: 'Telefone' }, { key: 'contato_nome', label: 'Contato' }] },
  { key: 'channels', label: 'Canais', singular: 'canal', table: 'channels', fields: [{ key: 'nome', label: 'Nome', required: true }, { key: 'tipo', label: 'Tipo', required: true }] },
  { key: 'full_destinations', label: 'Destinos Full', singular: 'destino Full', table: 'full_destinations', fields: [{ key: 'nome', label: 'Nome', required: true }, { key: 'marketplace_id', label: 'Marketplace', kind: 'marketplace-select' }, { key: 'endereco', label: 'Endereço' }, { key: 'codigo_agendamento_padrao', label: 'Código Agenda' }] },
  { key: 'transport_types', label: 'Transportes', singular: 'transporte', table: 'transport_types', fields: [{ key: 'nome', label: 'Nome', required: true }, { key: 'tipo', label: 'Tipo', required: true }] },
];

export function CadastrosManager({ role }: { role: UserProfileRole }) {
  const [activeSection, setActiveSection] = useState<Section>(sections[0]);
  const [rows, setRows] = useState<BaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [marketplaceOptions, setMarketplaceOptions] = useState<{ id: string; nome: string }[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [search, setSearch] = useState('');
  const toast = useToast();
  const marketplaceById = useMemo(() => new Map(marketplaceOptions.map((o) => [o.id, o.nome])), [marketplaceOptions]);
  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => activeSection.fields.some((f) => String(r[f.key] ?? '').toLowerCase().includes(term)));
  }, [rows, search, activeSection]);
  const extraFields = activeSection.fields.filter((f) => f.key !== 'nome');

  const canManage = role === 'admin' || role === 'gerente_estoque';

  const loadData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const query = supabase
      .from(activeSection.table)
      .select(activeSection.productCount ? '*, products(count)' : '*')
      .order('nome', { ascending: true })
      .limit(2000);
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
  }, [activeSection.table, activeSection.productCount, showInactive]);

  useEffect(() => {
    loadData();
    setForm({});
    setEditingId(null);
    setFormOpen(false);
  }, [activeSection, showInactive, loadData]);

  useEffect(() => {
    setSearch('');
  }, [activeSection]);

  useEffect(() => {
    const needsMarketplace = activeSection.fields.some((f) => f.kind === 'marketplace-select');
    if (!needsMarketplace) return;
    const supabase = createClient();
    supabase
      .from('channels')
      .select('id,nome')
      .eq('tipo', 'Marketplace Full')
      .eq('ativo', true)
      .order('nome')
      .then(({ data }) => setMarketplaceOptions((data ?? []) as { id: string; nome: string }[]));
  }, [activeSection]);

  function startEdit(row: BaseRow) {
    if (!canManage) return;
    const nextForm: Record<string, string> = {};
    for (const field of activeSection.fields) {
      const value = row[field.key];
      nextForm[field.key] = value == null ? '' : String(value);
    }
    setForm(nextForm);
    setEditingId(row.id);
    setFormOpen(true);
  }

  function startNew() {
    setForm({});
    setEditingId(null);
    setFormOpen(true);
  }

  function cancelEdit() {
    setForm({});
    setEditingId(null);
    setFormOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    const supabase = createClient();
    if (editingId) {
      const { error } = await supabase.from(activeSection.table).update(form).eq('id', editingId);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success('Cadastro atualizado.');
    } else {
      const payload = { ...form, ativo: true };
      const { error } = await supabase.from(activeSection.table).insert(payload);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success('Cadastro salvo.');
    }
    setForm({});
    setEditingId(null);
    setFormOpen(false);
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
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-semibold text-zinc-900">
              {activeSection.label}
              {!loading && <span className="ml-1.5 text-sm font-normal text-zinc-400">({visibleRows.length})</span>}
            </h2>
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input className="pl-9" placeholder="Buscar" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm text-zinc-600">
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
              Mostrar inativos
            </label>
            {canManage && (
              <Button variant="primary" className="ml-auto" onClick={startNew}>
                <Plus className="h-4 w-4" />
                Novo {activeSection.singular}
              </Button>
            )}
          </div>

          {canManage && (
            <Dialog
              open={formOpen}
              onClose={cancelEdit}
              title={`${editingId ? 'Editar' : 'Novo'} ${activeSection.singular}`}
              footer={
                <>
                  <Button type="button" variant="secondary" onClick={cancelEdit}>Cancelar</Button>
                  <Button type="submit" form="cadastro-form" variant="primary">{editingId ? 'Salvar alterações' : 'Salvar'}</Button>
                </>
              }
            >
              <form id="cadastro-form" onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {activeSection.fields.map((field) => (
                  <FieldGroup key={field.key} label={field.label} className={field.key === 'nome' || field.key === 'endereco' ? 'md:col-span-2' : undefined}>
                    {field.kind === 'marketplace-select' ? (
                      <Select
                        required={field.required}
                        value={form[field.key] ?? ''}
                        onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      >
                        <option value="">Selecionar</option>
                        {marketplaceOptions.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                      </Select>
                    ) : (
                      <Input
                        required={field.required}
                        value={form[field.key] ?? ''}
                        onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      />
                    )}
                  </FieldGroup>
                ))}
              </form>
            </Dialog>
          )}

          {loading ? (
            <SkeletonRows rows={5} />
          ) : loadError ? (
            <EmptyState title="Não foi possível carregar" description={loadError} />
          ) : visibleRows.length === 0 ? (
            <EmptyState
              title={rows.length === 0 ? 'Nada cadastrado ainda' : 'Nada encontrado'}
              description={rows.length > 0 ? 'Ajuste a busca.' : canManage ? `Use o botão “Novo ${activeSection.singular}” para cadastrar o primeiro.` : 'Nenhum registro disponível.'}
            />
          ) : (
            <div className="max-h-[65vh] overflow-auto rounded-lg border border-zinc-100">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-medium text-zinc-500">
                    <th className="px-3 py-2">Nome</th>
                    {extraFields.map((f) => <th key={f.key} className="px-3 py-2">{f.label}</th>)}
                    {activeSection.productCount && <th className="px-3 py-2 text-right">Produtos</th>}
                    <th className="px-3 py-2">Status</th>
                    {canManage && <th className="w-20 px-3 py-2" />}
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => {
                    const productCount = Array.isArray(row.products) ? Number((row.products[0] as { count?: number } | undefined)?.count ?? 0) : null;
                    return (
                      <tr key={row.id} className={cn('border-b border-zinc-50 last:border-0 hover:bg-zinc-50', !row.ativo && 'opacity-60')}>
                        <td className="px-3 py-2 font-medium text-zinc-800">{row.nome}</td>
                        {extraFields.map((f) => {
                          const raw = row[f.key];
                          const value = f.kind === 'marketplace-select' ? (raw ? marketplaceById.get(String(raw)) ?? '-' : '-') : raw == null || raw === '' ? '-' : String(raw);
                          return <td key={f.key} className="max-w-[16rem] truncate px-3 py-2 text-zinc-600" title={value}>{value}</td>;
                        })}
                        {activeSection.productCount && <td className="px-3 py-2 text-right tabular-nums text-zinc-600">{productCount ?? '-'}</td>}
                        <td className="px-3 py-2"><Badge tone={row.ativo ? 'success' : 'neutral'} dot>{row.ativo ? 'Ativo' : 'Inativo'}</Badge></td>
                        {canManage && (
                          <td className="whitespace-nowrap px-3 py-2 text-right">
                            <button aria-label={`Editar ${row.nome}`} title="Editar" className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700" onClick={() => startEdit(row)}>
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              aria-label={row.ativo ? `Inativar ${row.nome}` : `Ativar ${row.nome}`}
                              title={row.ativo ? 'Inativar' : 'Ativar'}
                              className={cn('rounded-lg p-1.5 hover:bg-zinc-100', row.ativo ? 'text-zinc-400 hover:text-amber-700' : 'text-emerald-600 hover:text-emerald-700')}
                              onClick={() => toggleActive(row)}
                            >
                              <Power className="h-4 w-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
