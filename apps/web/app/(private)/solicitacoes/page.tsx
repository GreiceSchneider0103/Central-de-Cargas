import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { UserProfile } from '@/lib/auth/roles';
import { SolicitacoesManager } from '@/components/solicitacoes/SolicitacoesManager';

export default async function SolicitacoesPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/login');

  const { data: profile } = await supabase
    .from('users_profile')
    .select('*')
    .eq('auth_user_id', userData.user.id)
    .single<UserProfile>();

  if (!profile) redirect('/');

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Solicitações de Carga</h1>
      <p className="text-zinc-600">Criação e fluxo de aprovação inicial da operação.</p>
      <SolicitacoesManager profile={profile} />
    </div>
  );
}
