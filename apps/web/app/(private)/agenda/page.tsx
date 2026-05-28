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

  const { data: loads } = await supabase.rpc('get_visible_loads');

  const orderedLoads = [...(loads ?? [])].sort((a, b) => String(a.data_agendada ?? '').localeCompare(String(b.data_agendada ?? '')));
  const enriched = await Promise.all(orderedLoads.map(async (l) => {
    const load = l as {
      id: string;
      canal_id?: string | null;
      loja_destino_id?: string | null;
      responsavel_operacional_id?: string | null;
    };
    const { data: items } = await supabase.from('load_items').select('suppliers(nome)').eq('load_id', load.id);
    const { data: comments } = await supabase.from('comments').select('texto,created_at').eq('entidade', 'load').eq('entidade_id', load.id).order('created_at', { ascending: false }).limit(1);
    const fornecedores = Array.from(new Set((items ?? []).map((i) => {
      const supplier = i.suppliers as { nome?: string }[] | { nome?: string } | null;
      return Array.isArray(supplier) ? supplier[0]?.nome : supplier?.nome;
    }).filter(Boolean))).join(', ');
    return {
      ...load,
      canal_nome: load.canal_id ?? null,
      loja_nome: load.loja_destino_id ?? null,
      responsavel_nome: load.responsavel_operacional_id ?? null,
      fornecedores,
      comentario: comments?.[0]?.texto ?? null,
    };
  }));

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Agenda de Cargas</h1>
          <p className="text-zinc-600">Visualização mensal por data agendada.</p>
        </div>
        <Link href="/cargas" className="px-3 py-2 bg-indigo-600 text-white rounded">Nova carga</Link>
      </div>
      <AgendaCalendar loads={enriched as AgendaLoads} profile={profile} />
    </div>
  );
}
