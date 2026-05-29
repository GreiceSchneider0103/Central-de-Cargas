import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ComponentProps } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { UserProfile } from '@/lib/auth/roles';
import { AgendaCalendar } from '@/components/agenda/AgendaCalendar';
type AgendaLoads = ComponentProps<typeof AgendaCalendar>['loads'];

export default async function AgendaPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/login');

  const { data: profile } = await supabase.from('users_profile').select('*').eq('auth_user_id', userData.user.id).single<UserProfile>();
  if (!profile) redirect('/');

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Agenda de Cargas</h1>
          <p className="text-zinc-600">Visualização mensal por data agendada.</p>
        </div>
        <Link href="/cargas" className="px-3 py-2 bg-indigo-600 text-white rounded">Nova carga</Link>
      </div>
      <AgendaCalendar loads={[] as unknown as AgendaLoads} profile={profile} />
    </div>
  );
}
