import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { UserProfile } from '@/lib/auth/roles';
import { CargasManager } from '@/components/cargas/CargasManager';

export default async function CargasPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/login');

  const { data: profile } = await supabase.from('users_profile').select('*').eq('auth_user_id', userData.user.id).single<UserProfile>();
  if (!profile) redirect('/');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Cargas oficiais</h1>
        <p className="text-sm text-zinc-500">Núcleo operacional de cargas, itens, checklist e financeiro.</p>
      </div>
      <CargasManager profile={profile} />
    </div>
  );
}
