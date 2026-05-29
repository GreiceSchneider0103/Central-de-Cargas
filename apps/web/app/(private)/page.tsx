import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardView } from '@/components/dashboard/DashboardView';
import type { UserProfile } from '@/lib/auth/roles';

type DashboardLoad = {
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
  fornecedores?: string | null;
  comentario?: string | null;
  [key: string]: string | number | null | undefined;
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/login');

  const { data: profile } = await supabase.from('users_profile').select('*').eq('auth_user_id', userData.user.id).single<UserProfile>();
  if (!profile) redirect('/');

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

  const [{ data: metricsRows }, { data: loads }] = await Promise.all([
    supabase.rpc('get_dashboard_metrics', { p_now: now.toISOString() }),
    supabase.rpc('get_visible_loads_enriched_range', { p_from: monthStart, p_to: monthEnd, p_limit: 1200 }),
  ]);

  const metrics = Array.isArray(metricsRows) ? metricsRows[0] : metricsRows;

  const { count: pendingRequests } = await supabase.from('load_requests').select('*', { count: 'exact', head: true }).eq('status', 'Pendente');

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Dashboard Operacional</h1>
      <DashboardView profile={profile} loads={(loads ?? []) as DashboardLoad[]} pendingRequests={pendingRequests ?? 0} metrics={metrics ?? null} />
    </div>
  );
}
