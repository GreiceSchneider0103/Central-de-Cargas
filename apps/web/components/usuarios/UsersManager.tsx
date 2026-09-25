'use client';

import { useMemo, useState } from 'react';
import { Pencil, Plus, Power, Search } from 'lucide-react';
import { PERFIL_LABEL, USER_PROFILES, type UserProfile } from '@/lib/auth/roles';
import { Dialog } from '@/components/ui/Dialog';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select, FieldGroup } from '@/components/ui/Field';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { translateError } from '@/lib/ui/error-messages';

type RegistryOption = { id: string; nome: string };

type Props = {
  profiles: UserProfile[];
  stores: RegistryOption[];
  companies: RegistryOption[];
};

type FormState = {
  id?: string;
  auth_user_id: string;
  nome: string;
  email: string;
  perfil: string;
  loja_id: string;
  empresa_id: string;
  ativo: boolean;
};

const emptyForm: FormState = {
  auth_user_id: '',
  nome: '',
  email: '',
  perfil: 'operador_carga',
  loja_id: '',
  empresa_id: '',
  ativo: true,
};

export function UsersManager({ profiles, stores, companies }: Props) {
  const [rows, setRows] = useState(profiles);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [manualLink, setManualLink] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [search, setSearch] = useState('');
  const toast = useToast();
  const storeById = useMemo(() => new Map(stores.map((s) => [s.id, s.nome])), [stores]);
  const companyById = useMemo(() => new Map(companies.map((c) => [c.id, c.nome])), [companies]);
  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const sorted = [...rows].sort((a, b) => Number(b.ativo) - Number(a.ativo) || (a.nome ?? a.email ?? '').localeCompare(b.nome ?? b.email ?? ''));
    if (!term) return sorted;
    return sorted.filter((r) => `${r.nome ?? ''} ${r.email ?? ''} ${PERFIL_LABEL[r.perfil] ?? r.perfil}`.toLowerCase().includes(term));
  }, [rows, search]);

  function edit(profile: UserProfile) {
    setForm({
      id: profile.id,
      auth_user_id: profile.auth_user_id,
      nome: profile.nome ?? '',
      email: profile.email ?? '',
      perfil: profile.perfil,
      loja_id: profile.loja_id ?? '',
      empresa_id: profile.empresa_id ?? '',
      ativo: profile.ativo,
    });
    setManualLink(false);
    setFormOpen(true);
  }

  function clearForm() {
    setForm(emptyForm);
    setManualLink(false);
  }

  function closeForm() {
    if (saving) return;
    clearForm();
    setFormOpen(false);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    const response = await fetch('/api/users-profile', {
      method: form.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, manual_link: manualLink }),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      toast.error(translateError(data.error, 'Erro ao salvar perfil.'));
      return;
    }
    if (form.id) {
      toast.success('Perfil atualizado.');
      setRows((current) => current.map((row) => row.id === form.id ? { ...row, ...form, perfil: form.perfil as UserProfile['perfil'], loja_id: form.loja_id || null, empresa_id: form.empresa_id || null } : row));
    } else {
      toast.success(manualLink ? 'Perfil vinculado com sucesso.' : 'Convite enviado por e-mail. O usuário define a senha pelo link recebido.');
      if (data.profile) setRows((current) => [...current, data.profile as UserProfile]);
    }
    clearForm();
    setFormOpen(false);
  }

  async function toggle(profile: UserProfile) {
    const payload = { ...profile, ativo: !profile.ativo };
    const response = await fetch('/api/users-profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const data = await response.json();
      toast.error(translateError(data.error, 'Erro ao atualizar o usuário.'));
      return;
    }
    setRows((current) => current.map((row) => row.id === profile.id ? { ...row, ativo: !row.ativo } : row));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input className="pl-9" placeholder="Buscar por nome, e-mail ou perfil" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button variant="primary" onClick={() => { clearForm(); setFormOpen(true); }}>
          <Plus className="h-4 w-4" />
          Novo usuário
        </Button>
      </div>

      <Dialog
        open={formOpen}
        onClose={closeForm}
        title={form.id ? 'Editar usuário' : 'Novo usuário'}
        description={form.id ? form.email : 'O sistema envia um convite por e-mail para o usuário definir a senha.'}
        size="lg"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={closeForm} disabled={saving}>Cancelar</Button>
            <Button type="submit" form="user-form" variant="primary" disabled={saving}>{saving ? 'Salvando...' : form.id ? 'Salvar' : 'Criar e convidar'}</Button>
          </>
        }
      >
        <form id="user-form" onSubmit={save} className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <FieldGroup label="Nome">
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </FieldGroup>
          <FieldGroup label="E-mail">
            <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </FieldGroup>
          <FieldGroup label="Perfil">
            <Select value={form.perfil} onChange={(e) => setForm({ ...form, perfil: e.target.value })}>
              {USER_PROFILES.map((role) => <option key={role} value={role}>{PERFIL_LABEL[role] ?? role}</option>)}
            </Select>
          </FieldGroup>
          <FieldGroup label="Status">
            <Select value={form.ativo ? 'true' : 'false'} onChange={(e) => setForm({ ...form, ativo: e.target.value === 'true' })}>
              <option value="true">Ativo</option>
              <option value="false">Inativo</option>
            </Select>
          </FieldGroup>
          <FieldGroup label="Loja vinculada">
            <Select value={form.loja_id} onChange={(e) => setForm({ ...form, loja_id: e.target.value })}>
              <option value="">Nenhuma</option>
              {stores.map((store) => <option key={store.id} value={store.id}>{store.nome}</option>)}
            </Select>
          </FieldGroup>
          <FieldGroup label="Empresa vinculada">
            <Select value={form.empresa_id} onChange={(e) => setForm({ ...form, empresa_id: e.target.value })}>
              <option value="">Nenhuma</option>
              {companies.map((company) => <option key={company.id} value={company.id}>{company.nome}</option>)}
            </Select>
          </FieldGroup>
          {!form.id && (
            <label className="flex items-center gap-2 text-sm text-zinc-600 md:col-span-2">
              <input type="checkbox" checked={manualLink} onChange={(e) => setManualLink(e.target.checked)} />
              Já existe no Auth — vincular pelo UUID (avançado)
            </label>
          )}
          {(form.id || manualLink) && (
            <FieldGroup label="Auth user UUID" className="md:col-span-2">
              <Input placeholder="uuid do usuário no Supabase Auth" value={form.auth_user_id} disabled={Boolean(form.id)} onChange={(e) => setForm({ ...form, auth_user_id: e.target.value })} required={manualLink} />
            </FieldGroup>
          )}
        </form>
      </Dialog>

      <Card>
        <CardBody className="p-0">
          {rows.length === 0 ? (
            <EmptyState title="Nenhum usuário cadastrado ainda" description="Use o botão “Novo usuário” para criar o primeiro perfil." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-medium text-zinc-500">
                    <th className="px-3 py-2.5">Usuário</th>
                    <th className="px-3 py-2.5">Perfil</th>
                    <th className="px-3 py-2.5">Loja / empresa</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="w-20 px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((profile) => {
                    const vinculo = [profile.loja_id && storeById.get(profile.loja_id), profile.empresa_id && companyById.get(profile.empresa_id)].filter(Boolean).join(' · ');
                    return (
                      <tr key={profile.id} className={`border-b border-zinc-50 last:border-0 hover:bg-zinc-50 ${profile.ativo ? '' : 'opacity-60'}`}>
                        <td className="px-3 py-2">
                          <div className="font-medium text-zinc-800">{profile.nome || '-'}</div>
                          <div className="text-xs text-zinc-500">{profile.email ?? '-'}</div>
                        </td>
                        <td className="px-3 py-2 text-zinc-600">{PERFIL_LABEL[profile.perfil] ?? profile.perfil}</td>
                        <td className="px-3 py-2 text-zinc-600">{vinculo || '-'}</td>
                        <td className="px-3 py-2"><Badge tone={profile.ativo ? 'success' : 'neutral'} dot>{profile.ativo ? 'Ativo' : 'Inativo'}</Badge></td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">
                          <button aria-label={`Editar ${profile.nome ?? profile.email}`} title="Editar" className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700" onClick={() => edit(profile)}>
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            aria-label={profile.ativo ? 'Inativar' : 'Ativar'}
                            title={profile.ativo ? 'Inativar' : 'Ativar'}
                            className={`rounded-lg p-1.5 hover:bg-zinc-100 ${profile.ativo ? 'text-zinc-400 hover:text-amber-700' : 'text-emerald-600 hover:text-emerald-700'}`}
                            onClick={() => toggle(profile)}
                          >
                            <Power className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {visibleRows.length === 0 && (
                    <tr><td colSpan={5} className="px-3 py-4 text-center text-zinc-400">Nenhum usuário encontrado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
