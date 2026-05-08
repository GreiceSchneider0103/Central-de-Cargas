'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { UserProfileRole } from '@/lib/auth/roles';

type BaseRow = {
  id: string;
  nome: string;
  ativo: boolean;
};

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
  const [rows, setRows] = useState<unknown[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const canManage = role === 'admin' || role === 'gerente_estoque';

  const baseSelect = useMemo(() => 'id,nome,ativo,created_at,updated_at,cnpj,telefone,contato_nome,tipo,marketplace_id,endereco,codigo_agendamento_padrao', []);

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const query = supabase.from(activeSection.table).select(baseSelect).order('nome', { ascending: true });
    if (!showInactive) query.eq('ativo', true);
    const { data, error } = await query;
    if (error) {
      setError(error.message);
      return;
    }
    setRows(data ?? []);
    setError(null);
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
      setError(error.message);
      return;
    }
    setForm({});
    await loadData();
  }

  async function toggleActive(row: BaseRow) {
    if (!canManage) return;
    const supabase = createClient();
    const { error } = await supabase.from(activeSection.table).update({ ativo: !row.ativo }).eq('id', row.id);
    if (error) {
      setError(error.message);
      return;
    }
    await loadData();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {sections.map((section) => (
          <button key={section.key} onClick={() => setActiveSection(section)} className={`px-4 py-2 rounded ${activeSection.key === section.key ? 'bg-zinc-900 text-white' : 'bg-white border'}`}>
            {section.label}
          </button>
        ))}
      </div>

      <div className="bg-white border rounded-xl p-4 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold">{activeSection.label}</h2>
          <label className="text-sm flex items-center gap-2">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            Mostrar inativos
          </label>
        </div>

        {canManage && (
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {activeSection.fields.map((field) => (
              <input
                key={field.key}
                placeholder={field.label}
                required={field.required}
                className="h-10 rounded border px-3"
                value={form[field.key] ?? ''}
                onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
              />
            ))}
            <button className="h-10 rounded bg-indigo-600 text-white px-4">Salvar</button>
          </form>
        )}

        {error && <p className="text-sm text-rose-600">{error}</p>}

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2">Nome</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b">
                <td className="py-2">{row.nome}</td>
                <td>{row.ativo ? 'Ativo' : 'Inativo'}</td>
                <td>
                  {canManage ? (
                    <button onClick={() => toggleActive(row)} className="text-indigo-600">
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
    </div>
  );
}
