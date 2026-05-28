import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { UserProfile } from '@/lib/auth/roles';
import { CommentForm } from '@/components/comments/CommentForm';

type VisibleRequestItem = {
  id: string;
  sku: string | null;
  nome_produto: string | null;
  quantidade: number | null;
  cmv_unitario: number | null;
  cmv_total: number | null;
};

type CommentRow = { id: string; texto: string | null; created_at: string };

export default async function SolicitacaoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/login');

  const { data: profile } = await supabase.from('users_profile').select('*').eq('auth_user_id', userData.user.id).single<UserProfile>();
  if (!profile) redirect('/');

  const { data: request } = await supabase
    .from('load_requests')
    .select('*, companies(nome), stores(nome), channels(nome), full_destinations(nome)')
    .eq('id', id)
    .single();

  const canSeeFinancial = ['admin', 'gerente_estoque', 'gerente_ecommerce', 'financeiro'].includes(profile.perfil);

  const { data: items } = await supabase.rpc('get_visible_load_request_items', { p_request_id: id });
  const { data: history } = await supabase.from('load_request_history').select('*').eq('request_id', id).order('created_at', { ascending: false });
  const { data: comments } = await supabase.from('comments').select('id,texto,created_at').eq('entidade', 'load_request').eq('entidade_id', id).order('created_at', { ascending: false }).limit(20);

  if (!request) redirect('/solicitacoes');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{request.codigo}</h1>
        <p className="text-zinc-600">Status: {request.status}</p>
      </div>

      <div className="bg-white border rounded-xl p-4 space-y-1 text-sm">
        <p><strong>Tipo:</strong> {request.tipo}</p>
        <p><strong>Empresa:</strong> {request.companies?.nome ?? '-'}</p>
        <p><strong>Canal:</strong> {request.channels?.nome ?? '-'}</p>
        <p><strong>Destino Full:</strong> {request.full_destinations?.nome ?? '-'}</p>
        <p><strong>Loja destino:</strong> {request.stores?.nome ?? '-'}</p>
        <p><strong>Observações:</strong> {request.observacoes ?? '-'}</p>
        <p><strong>Motivo recusa:</strong> {request.motivo_recusa ?? '-'}</p>
      </div>

      <div className="bg-white border rounded-xl p-4">
        <h2 className="font-semibold mb-2">Itens</h2>
        <table className="w-full text-sm"><thead><tr className="border-b"><th>SKU</th><th>Produto</th><th>Qtd</th>{canSeeFinancial && <th>CMV Unit.</th>}{canSeeFinancial && <th>CMV Total</th>}</tr></thead><tbody>
          {((items ?? []) as VisibleRequestItem[]).map((i) => <tr key={i.id} className="border-b"><td>{i.sku}</td><td>{i.nome_produto}</td><td>{i.quantidade}</td>{canSeeFinancial && <td>{i.cmv_unitario}</td>}{canSeeFinancial && <td>{i.cmv_total}</td>}</tr>)}
        </tbody></table>
      </div>

      <div className="bg-white border rounded-xl p-4 space-y-3">
        <h2 className="font-semibold">Comentários</h2>
        <CommentForm entidade="load_request" entidadeId={id} />
        <ul className="text-sm space-y-2">{((comments ?? []) as CommentRow[]).map((c) => <li key={c.id} className="border-b pb-2">{c.texto}<br /><span className="text-xs text-zinc-500">{new Date(c.created_at).toLocaleString('pt-BR')}</span></li>)}</ul>
      </div>

      <div className="bg-white border rounded-xl p-4">
        <h2 className="font-semibold mb-2">Histórico</h2>
        <ul className="text-sm space-y-2">
          {(history ?? []).map((h) => <li key={h.id} className="border-b pb-2"><strong>{h.acao}</strong> — {h.status_anterior ?? '-'} → {h.status_novo ?? '-'} ({new Date(h.created_at).toLocaleString('pt-BR')})<br />{h.observacao ?? ''}</li>)}
        </ul>
      </div>
    </div>
  );
}
