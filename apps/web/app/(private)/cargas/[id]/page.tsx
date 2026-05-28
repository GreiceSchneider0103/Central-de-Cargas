import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { UserProfile } from '@/lib/auth/roles';
import { CommentForm } from '@/components/comments/CommentForm';

type VisibleLoad = {
  id: string;
  codigo_interno: string | null;
  status: string | null;
  data_agendada: string | null;
};

type VisibleLoadItem = {
  id: string;
  sku: string | null;
  nome_produto: string | null;
  quantidade: number | null;
  cmv_total: number | null;
};

type CommentRow = { id: string; texto: string | null; created_at: string };

export default async function CargaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/login');

  const { data: profile } = await supabase
    .from('users_profile')
    .select('*')
    .eq('auth_user_id', userData.user.id)
    .single<UserProfile>();
  if (!profile) redirect('/login');

  const canSeeFinancial = ['admin', 'gerente_estoque', 'gerente_ecommerce', 'financeiro'].includes(profile.perfil);

  const { data: loads } = await supabase.rpc('get_visible_loads');
  const load = ((loads ?? []) as VisibleLoad[]).find((row) => row.id === id);
  const { data: items } = await supabase.rpc('get_visible_load_items', { p_load_id: id });
  const { data: checklist } = await supabase.from('load_checklists').select('*').eq('load_id', id).single();
  const { data: comments } = await supabase.from('comments').select('id,texto,created_at').eq('entidade', 'load').eq('entidade_id', id).order('created_at', { ascending: false }).limit(20);

  if (!load) redirect('/cargas');

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{load.codigo_interno}</h1>
      <p>Status: {load.status}</p>
      <p>Data agendada: {load.data_agendada ? new Date(load.data_agendada).toLocaleString('pt-BR') : '-'}</p>
      <table className="w-full text-sm bg-white border"><thead><tr><th>SKU</th><th>Nome</th><th>Qtd</th>{canSeeFinancial && <th>CMV Total</th>}</tr></thead><tbody>
        {((items ?? []) as VisibleLoadItem[]).map((i) => <tr key={i.id}><td>{i.sku}</td><td>{i.nome_produto}</td><td>{i.quantidade}</td>{canSeeFinancial && <td>{i.cmv_total}</td>}</tr>)}
      </tbody></table>
      <pre className="bg-zinc-100 p-3 rounded text-xs overflow-auto">{JSON.stringify(checklist, null, 2)}</pre>
      <div className="bg-white border rounded-xl p-4 space-y-3">
        <h2 className="font-semibold">Comentários</h2>
        <CommentForm entidade="load" entidadeId={id} />
        <ul className="text-sm space-y-2">{((comments ?? []) as CommentRow[]).map((c) => <li key={c.id} className="border-b pb-2">{c.texto}<br /><span className="text-xs text-zinc-500">{new Date(c.created_at).toLocaleString('pt-BR')}</span></li>)}</ul>
      </div>
    </div>
  );
}
