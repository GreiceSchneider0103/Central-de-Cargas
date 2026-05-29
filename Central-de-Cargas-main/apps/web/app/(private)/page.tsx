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

  const { data: loadsBase } = await supabase.rpc('get_visible_loads');

  const dashboardLoadsBase = ((loadsBase ?? []) as DashboardLoadBase[]).slice(0, 500);
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
