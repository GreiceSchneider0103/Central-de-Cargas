import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardView } from '@/components/dashboard/DashboardView';
import type { UserProfile } from '@/lib/auth/roles';

type DashboardLoadBase = {
  id: string;
  codigo_interno: string | null;
  tipo: string | null;
  status: string | null;
  data_agendada: string | null;
  data_prevista_recebimento: string | null;
  created_at: string | null;
  empresa_id: string | null;
  canal_id: string | null;
  marketplace_id: string | null;
  loja_destino_id: string | null;
  responsavel_operacional_id: string | null;
  [key: string]: unknown;
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/login');

  const { data: profile } = await supabase.from('users_profile').select('*').eq('auth_user_id', userData.user.id).single<UserProfile>();
  if (!profile) redirect('/');

  const canSeeFinancial = ['admin', 'gerente_estoque', 'financeiro', 'gerente_ecommerce'].includes(profile.perfil);
  let loadQuery = canSeeFinancial
    ? supabase.from('loads').select('*').order('created_at', { ascending: false }).limit(500)
    : supabase
        .from('loads')
        .select('id,codigo_interno,tipo,status,data_agendada,data_prevista_recebimento,created_at,empresa_id,canal_id,marketplace_id,loja_destino_id,responsavel_operacional_id')
        .order('created_at', { ascending: false })
        .limit(500);
  if (profile.perfil === 'gerente_ecommerce') loadQuery = loadQuery.eq('tipo', 'FULL_MARKETPLACE');
  if (profile.perfil === 'vendedor_loja') loadQuery = loadQuery.eq('loja_destino_id', profile.loja_id);

  const { data: loadsBase } = await loadQuery;

  const dashboardLoadsBase = (loadsBase ?? []) as DashboardLoadBase[];
  const loads = await Promise.all(dashboardLoadsBase.map(async (l) => {
    const { data: items } = await supabase.from('load_items').select('suppliers(nome)').eq('load_id', l.id);
    const fornecedores = Array.from(new Set((items ?? []).map((i) => {
      const supplier = i.suppliers as { nome?: string }[] | { nome?: string } | null;
      return Array.isArray(supplier) ? supplier[0]?.nome : supplier?.nome;
    }).filter(Boolean))).join(', ');
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
