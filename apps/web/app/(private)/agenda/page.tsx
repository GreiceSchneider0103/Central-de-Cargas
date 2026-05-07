import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { UserProfile } from '@/lib/auth/roles';
import { AgendaCalendar } from '@/components/agenda/AgendaCalendar';

export default async function AgendaPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/login');

  const { data: profile } = await supabase.from('users_profile').select('*').eq('auth_user_id', userData.user.id).single<UserProfile>();
  if (!profile) redirect('/');

  let query = supabase.from('loads').select('id,codigo_interno,numero_carga_marketplace,codigo_agendamento,tipo,status,data_agendada,data_prevista_recebimento,data_real_recebimento,cmv_total,loja_destino_id,marketplace_id,empresa_id,responsavel_operacional_id,channels(nome),stores(nome),users_profile(nome)').order('data_agendada', { ascending: true });
  if (profile.perfil === 'vendedor_loja') query = query.eq('loja_destino_id', profile.loja_id);

  const { data: loads } = await query;

  const enriched = await Promise.all((loads ?? []).map(async (l: any) => {
    const { data: items } = await supabase.from('load_items').select('suppliers(nome)').eq('load_id', l.id);
    const { data: comments } = await supabase.from('comments').select('texto,created_at').eq('entidade', 'load').eq('entidade_id', l.id).order('created_at', { ascending: false }).limit(1);
    const fornecedores = Array.from(new Set((items ?? []).map((i: any) => i.suppliers?.nome).filter(Boolean))).join(', ');
    return {
      ...l,
      canal_nome: l.channels?.nome ?? null,
      loja_nome: l.stores?.nome ?? null,
      responsavel_nome: l.users_profile?.nome ?? null,
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
        <a href="/cargas" className="px-3 py-2 bg-indigo-600 text-white rounded">Nova carga</a>
      </div>
      <AgendaCalendar loads={enriched as any} profile={profile} />
    </div>
  );
}
