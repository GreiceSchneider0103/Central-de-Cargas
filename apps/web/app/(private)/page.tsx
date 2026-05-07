import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardView } from '@/components/dashboard/DashboardView';
import type { UserProfile } from '@/lib/auth/roles';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/login');

  const { data: profile } = await supabase.from('users_profile').select('*').eq('auth_user_id', userData.user.id).single<UserProfile>();
  if (!profile) redirect('/');

  const canSeeFinancial = ['admin', 'gerente_estoque', 'financeiro', 'gerente_ecommerce'].includes(profile.perfil);
  const selectFields = canSeeFinancial
    ? '*'
    : 'id,codigo_interno,tipo,status,data_agendada,data_prevista_recebimento,created_at,empresa_id,canal_id,marketplace_id,loja_destino_id,responsavel_operacional_id';

  let loadQuery = supabase.from('loads').select(selectFields).order('created_at', { ascending: false }).limit(500);
  if (profile.perfil === 'gerente_ecommerce') loadQuery = loadQuery.eq('tipo', 'FULL_MARKETPLACE');
  if (profile.perfil === 'vendedor_loja') loadQuery = loadQuery.eq('loja_destino_id', profile.loja_id);

  const { data: loadsBase } = await loadQuery;

  const loads = await Promise.all((loadsBase ?? []).map(async (l: any) => {
    const { data: items } = await supabase.from('load_items').select('suppliers(nome)').eq('load_id', l.id);
    const fornecedores = Array.from(new Set((items ?? []).map((i: any) => i.suppliers?.nome).filter(Boolean))).join(', ');
    return { ...l, fornecedores };
  }));

  const { count: pendingRequests } = await supabase.from('load_requests').select('*', { count: 'exact', head: true }).eq('status', 'Pendente');

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Dashboard Operacional</h1>
      <DashboardView profile={profile} loads={loads} pendingRequests={pendingRequests ?? 0} />
    </div>
  );
}
