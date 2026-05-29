import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { UserProfile } from '@/lib/auth/roles';
import { UsersManager } from '@/components/usuarios/UsersManager';

export default async function UsuariosPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/login');

  const { data: profile } = await supabase.from('users_profile').select('*').eq('auth_user_id', userData.user.id).single<UserProfile>();
  if (!profile || profile.perfil !== 'admin') redirect('/');

  const [{ data: profiles }, { data: stores }, { data: companies }] = await Promise.all([
    supabase.from('users_profile').select('*').order('created_at', { ascending: false }).limit(100),
    supabase.from('stores').select('id,nome').eq('ativo', true).order('nome'),
    supabase.from('companies').select('id,nome').eq('ativo', true).order('nome'),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Usuários</h1>
      <p className="text-zinc-600">Administração mínima de perfis, acesso e vínculos operacionais.</p>
      <UsersManager profiles={(profiles ?? []) as UserProfile[]} stores={stores ?? []} companies={companies ?? []} />
    </div>
  );
}
