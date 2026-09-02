'use client';

import { useState } from 'react';
import { USER_PROFILES, type UserProfile } from '@/lib/auth/roles';
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
  const toast = useToast();

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
  }

  function clearForm() {
    setForm(emptyForm);
    setManualLink(false);
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
      <Card>
        <CardBody>
          <h2 className="mb-3 font-semibold text-zinc-900">{form.id ? 'Editar perfil' : 'Novo perfil'}</h2>
          <form onSubmit={save} className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {!form.id && (
              <p className="md:col-span-3 text-sm text-zinc-500">
                Ao criar, o sistema envia um convite por e-mail para o usuário definir a senha — não é preciso saber o UUID dele no Auth.
              </p>
            )}
            <FieldGroup label="Nome">
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </FieldGroup>
            <FieldGroup label="E-mail">
              <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </FieldGroup>
            {!form.id && (
              <label className="flex items-center gap-2 text-sm text-zinc-600">
                <input type="checkbox" checked={manualLink} onChange={(e) => setManualLink(e.target.checked)} />
                Já existe no Auth — vincular pelo UUID (avançado)
              </label>
            )}
            {(form.id || manualLink) && (
              <FieldGroup label="Auth user UUID">
                <Input placeholder="uuid do usuário no Supabase Auth" value={form.auth_user_id} disabled={Boolean(form.id)} onChange={(e) => setForm({ ...form, auth_user_id: e.target.value })} required={manualLink} />
              </FieldGroup>
            )}
            <FieldGroup label="Perfil">
              <Select value={form.perfil} onChange={(e) => setForm({ ...form, perfil: e.target.value })}>
                {USER_PROFILES.map((role) => <option key={role} value={role}>{role}</option>)}
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
            <label className="flex items-center gap-2 text-sm text-zinc-600">
              <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} /> Ativo
            </label>
            <div className="flex gap-2 md:col-span-2">
              <Button type="submit" variant="primary" disabled={saving}>{saving ? 'Salvando...' : form.id ? 'Atualizar perfil' : 'Criar perfil'}</Button>
              <Button type="button" variant="secondary" onClick={clearForm}>Limpar</Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="p-0">
          {rows.length === 0 ? (
            <EmptyState title="Nenhum usuário cadastrado ainda" description="Use o formulário acima para criar o primeiro perfil." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-left text-xs font-medium text-zinc-500">
                    <th className="px-4 py-2.5">Nome</th>
                    <th className="px-4 py-2.5">E-mail</th>
                    <th className="px-4 py-2.5">Perfil</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((profile) => (
                    <tr key={profile.id} className="border-b border-zinc-50 last:border-0">
                      <td className="px-4 py-2.5 font-medium text-zinc-800">{profile.nome ?? '-'}</td>
                      <td className="px-4 py-2.5 text-zinc-600">{profile.email ?? '-'}</td>
                      <td className="px-4 py-2.5 text-zinc-600">{profile.perfil}</td>
                      <td className="px-4 py-2.5"><Badge tone={profile.ativo ? 'success' : 'neutral'} dot>{profile.ativo ? 'Ativo' : 'Inativo'}</Badge></td>
                      <td className="space-x-3 px-4 py-2.5 text-right">
                        <button className="font-medium text-brand-600 hover:text-brand-700" onClick={() => edit(profile)}>Editar</button>
                        <button className="font-medium text-amber-700 hover:text-amber-800" onClick={() => toggle(profile)}>{profile.ativo ? 'Inativar' : 'Ativar'}</button>
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
