'use client';

import { useState } from 'react';
import { USER_PROFILES, type UserProfile } from '@/lib/auth/roles';

type RegistryOption = { id: string; nome: string };

type Props = {
  profiles: UserProfile[];
  stores: RegistryOption[];
  companies: RegistryOption[];
};

type FormState = {
  id?: string;
  nome: string;
  email: string;
  perfil: string;
  loja_id: string;
  empresa_id: string;
  ativo: boolean;
};

const emptyForm: FormState = {
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
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function edit(profile: UserProfile) {
    setForm({
      id: profile.id,
      nome: profile.nome ?? '',
      email: profile.email ?? '',
      perfil: profile.perfil,
      loja_id: profile.loja_id ?? '',
      empresa_id: profile.empresa_id ?? '',
      ativo: profile.ativo,
    });
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    const response = await fetch('/api/users-profile', {
      method: form.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      if (response.status === 409) setMessage('Já existe uma conta com esse e-mail.');
      else if (data.error === 'INVITE_FAILED') setMessage(data.detail || 'Erro ao enviar convite por e-mail.');
      else setMessage(data.error || 'Erro ao salvar perfil.');
      return;
    }
    setMessage(form.id ? 'Perfil salvo. Recarregue a página para atualizar a lista.' : 'Usuário criado! Um e-mail de convite foi enviado para definir a senha.');
    if (form.id) {
      setRows((current) => current.map((row) => row.id === form.id ? { ...row, ...form, perfil: form.perfil as UserProfile['perfil'], loja_id: form.loja_id || null, empresa_id: form.empresa_id || null } : row));
    }
    setForm(emptyForm);
  }

  async function toggle(profile: UserProfile) {
    const payload = { ...profile, ativo: !profile.ativo };
    const response = await fetch('/api/users-profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (response.ok) {
      setRows((current) => current.map((row) => row.id === profile.id ? { ...row, ativo: !row.ativo } : row));
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={save} className="bg-white border rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
        {!form.id && <p className="md:col-span-3 text-zinc-600">Ao criar, um e-mail de convite é enviado automaticamente pelo Supabase Auth para o usuário definir a senha.</p>}
        <input className="h-10 border rounded px-2" placeholder="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
        <input className="h-10 border rounded px-2" placeholder="E-mail" type="email" value={form.email} disabled={Boolean(form.id)} onChange={(e) => setForm({ ...form, email: e.target.value })} required={!form.id} />
        <select className="h-10 border rounded px-2" value={form.perfil} onChange={(e) => setForm({ ...form, perfil: e.target.value })}>
          {USER_PROFILES.map((role) => <option key={role} value={role}>{role}</option>)}
        </select>
        <select className="h-10 border rounded px-2" value={form.loja_id} onChange={(e) => setForm({ ...form, loja_id: e.target.value })}>
          <option value="">Loja</option>
          {stores.map((store) => <option key={store.id} value={store.id}>{store.nome}</option>)}
        </select>
        <select className="h-10 border rounded px-2" value={form.empresa_id} onChange={(e) => setForm({ ...form, empresa_id: e.target.value })}>
          <option value="">Empresa</option>
          {companies.map((company) => <option key={company.id} value={company.id}>{company.nome}</option>)}
        </select>
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} /> Ativo</label>
        <button disabled={saving} className="h-10 rounded bg-indigo-600 text-white disabled:opacity-50">{saving ? 'Salvando...' : form.id ? 'Atualizar perfil' : 'Criar perfil'}</button>
        <button type="button" className="h-10 rounded border" onClick={() => setForm(emptyForm)}>Limpar</button>
      </form>
      {message && <p className="text-sm text-zinc-600">{message}</p>}
      <div className="bg-white border rounded-xl p-4">
        <table className="w-full text-sm">
          <thead><tr className="border-b"><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>
            {rows.map((profile) => (
              <tr key={profile.id} className="border-b">
                <td>{profile.nome ?? '-'}</td><td>{profile.email ?? '-'}</td><td>{profile.perfil}</td><td>{profile.ativo ? 'Ativo' : 'Inativo'}</td>
                <td className="space-x-2"><button className="text-indigo-600" onClick={() => edit(profile)}>Editar</button><button className="text-amber-700" onClick={() => toggle(profile)}>{profile.ativo ? 'Inativar' : 'Ativar'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
