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
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Solicitações de carga</h1>
        <p className="text-sm text-zinc-500">Criação e fluxo de aprovação inicial da operação.</p>
      </div>
      <SolicitacoesManager profile={profile} />
    </div>
  );
}
