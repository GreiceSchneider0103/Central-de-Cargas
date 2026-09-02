import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { UserProfile } from '@/lib/auth/roles';
import { AgendaCalendar } from '@/components/agenda/AgendaCalendar';
import type { AgendaOptions } from '@/components/agenda/types';

export default async function AgendaPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/login');

  const { data: profile } = await supabase
    .from('users_profile')
    .select('*')
    .eq('auth_user_id', userData.user.id)
    .single<UserProfile>();
  if (!profile) redirect('/');

  const [companiesRes, channelsRes, storesRes, fullDestinationsRes, suppliersRes] =
    await Promise.all([
      supabase.from('companies').select('id,nome').eq('ativo', true).order('nome').limit(200),
      supabase.from('channels').select('id,nome').eq('ativo', true).order('nome').limit(200),
      supabase.from('stores').select('id,nome').eq('ativo', true).order('nome').limit(200),
      supabase
        .from('full_destinations')
        .select('id,nome')
        .eq('ativo', true)
        .order('nome')
        .limit(200),
      supabase.from('suppliers').select('id,nome').eq('ativo', true).order('nome').limit(200),
    ]);

  const options: AgendaOptions = {
    companies: companiesRes.data ?? [],
    channels: channelsRes.data ?? [],
    stores: storesRes.data ?? [],
    fullDestinations: fullDestinationsRes.data ?? [],
    suppliers: suppliersRes.data ?? [],
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Agenda de cargas</h1>
        <p className="text-sm text-zinc-500">Arraste uma carga pra outro dia/horário pra reagendar, ou clique nela pra ver os detalhes.</p>
      </div>
      <AgendaCalendar loads={[]} profile={profile} options={options} />
    </div>
  );
}
