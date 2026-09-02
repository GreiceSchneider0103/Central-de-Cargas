import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { UserProfile } from '@/lib/auth/roles';
import { CommentForm } from '@/components/comments/CommentForm';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { requestStatusTone } from '@/lib/ui/status-styles';

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

  const typedItems = (items ?? []) as VisibleRequestItem[];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-zinc-900">{request.codigo}</h1>
        <Badge tone={requestStatusTone(request.status)} dot>{request.status}</Badge>
      </div>

      <Card>
        <CardBody className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm md:grid-cols-2">
          <p><span className="text-zinc-500">Tipo:</span> <span className="font-medium">{request.tipo === 'FULL_MARKETPLACE' ? 'Full Marketplace' : 'Loja física'}</span></p>
          <p><span className="text-zinc-500">Empresa:</span> <span className="font-medium">{request.companies?.nome ?? '-'}</span></p>
          <p><span className="text-zinc-500">Canal:</span> <span className="font-medium">{request.channels?.nome ?? '-'}</span></p>
          <p><span className="text-zinc-500">Destino Full:</span> <span className="font-medium">{request.full_destinations?.nome ?? '-'}</span></p>
          <p><span className="text-zinc-500">Loja destino:</span> <span className="font-medium">{request.stores?.nome ?? '-'}</span></p>
          <p><span className="text-zinc-500">Observações:</span> <span className="font-medium">{request.observacoes ?? '-'}</span></p>
          {request.motivo_recusa && <p className="md:col-span-2 text-rose-700"><span className="text-rose-500">Motivo da recusa:</span> {request.motivo_recusa}</p>}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Itens" />
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left text-xs font-medium text-zinc-500">
                  <th className="px-4 py-2">SKU</th>
                  <th className="px-4 py-2">Produto</th>
                  <th className="px-4 py-2">Qtd</th>
                  {canSeeFinancial && <th className="px-4 py-2">CMV unit.</th>}
                  {canSeeFinancial && <th className="px-4 py-2">CMV total</th>}
                </tr>
              </thead>
              <tbody>
                {typedItems.map((i) => (
                  <tr key={i.id} className="border-b border-zinc-50 last:border-0">
                    <td className="px-4 py-2">{i.sku}</td>
                    <td className="px-4 py-2">{i.nome_produto}</td>
                    <td className="px-4 py-2">{i.quantidade}</td>
                    {canSeeFinancial && <td className="px-4 py-2">{i.cmv_unitario}</td>}
                    {canSeeFinancial && <td className="px-4 py-2">{i.cmv_total}</td>}
                  </tr>
                ))}
                {typedItems.length === 0 && (
                  <tr><td colSpan={canSeeFinancial ? 5 : 3} className="px-4 py-4 text-center text-zinc-400">Sem itens.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Comentários" />
        <CardBody className="space-y-3">
          <CommentForm entidade="load_request" entidadeId={id} />
          <ul className="space-y-2 text-sm">
            {((comments ?? []) as CommentRow[]).map((c) => (
              <li key={c.id} className="border-b border-zinc-50 pb-2 last:border-0">
                {c.texto}
                <br />
                <span className="text-xs text-zinc-500">{new Date(c.created_at).toLocaleString('pt-BR')}</span>
              </li>
            ))}
            {(comments ?? []).length === 0 && <li className="text-zinc-400">Sem comentários ainda.</li>}
          </ul>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Histórico" />
        <CardBody>
          <ul className="space-y-2 text-sm">
            {(history ?? []).map((h) => (
              <li key={h.id} className="border-b border-zinc-50 pb-2 last:border-0">
                <strong>{h.acao}</strong> — {h.status_anterior ?? '-'} → {h.status_novo ?? '-'} ({new Date(h.created_at).toLocaleString('pt-BR')})
                <br />
                <span className="text-zinc-500">{h.observacao ?? ''}</span>
              </li>
            ))}
            {(history ?? []).length === 0 && <li className="text-zinc-400">Sem histórico ainda.</li>}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
