import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { UserProfile } from '@/lib/auth/roles';
import { CommentForm } from '@/components/comments/CommentForm';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ArrowLeft, Truck } from 'lucide-react';
import { loadStatusTone, priorityTone, requestStatusTone } from '@/lib/ui/status-styles';
import { money } from '@/lib/ui/format';
import Link from 'next/link';
import { ResubmitRequest } from '@/components/solicitacoes/ResubmitRequest';

type VisibleRequestItem = {
  id: string;
  sku: string | null;
  nome_produto: string | null;
  quantidade: number | null;
  cmv_unitario: number | null;
  cmv_total: number | null;
};

type CommentRow = { id: string; texto: string | null; created_at: string };

const HISTORY_LABELS: Record<string, string> = {
  CRIADA: 'Solicitação criada',
  REENVIADA: 'Reenviada após ajuste',
  REQUEST_APPROVED: 'Aprovada',
  REQUEST_REJECTED: 'Recusada',
  REQUEST_ADJUST: 'Ajuste solicitado',
  request_converted_to_load: 'Transformada em carga',
  REQUEST_CONVERTED_TO_LOAD: 'Transformada em carga',
};

const dateTime = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-';

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="mt-0.5 truncate font-medium text-zinc-800">{children}</dd>
    </div>
  );
}

const brl = (v: number | string | null | undefined) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

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
  const historyRows = (history ?? []) as { id: string; acao: string; observacao: string | null; status_anterior: string | null; status_novo: string | null; created_at: string }[];
  const lastAdjust = historyRows.find((h) => h.acao === 'REQUEST_ADJUST');
  const canResubmit =
    request.status === 'Ajuste solicitado' && (request.solicitante_id === profile.id || ['admin', 'gerente_estoque'].includes(profile.perfil));
  const { data: load } = request.carga_id
    ? await supabase.from('loads').select('codigo_interno,status,data_agendada').eq('id', request.carga_id).maybeSingle()
    : { data: null };


  const unidades = typedItems.reduce((sum, i) => sum + Number(i.quantidade ?? 0), 0);
  const cmvTotal = typedItems.reduce((sum, i) => sum + Number(i.cmv_total ?? 0), 0);
  const destino =
    request.tipo === 'FULL_MARKETPLACE'
      ? [request.channels?.nome, request.full_destinations?.nome].filter(Boolean).join(' · ') || '-'
      : request.stores?.nome ?? '-';

  return (
    <div className="space-y-4">
      <Link href="/solicitacoes" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800">
        <ArrowLeft className="h-4 w-4" />
        Solicitações
      </Link>

      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold text-zinc-900">{request.codigo}</h1>
        <Badge tone={requestStatusTone(request.status)} dot>{request.status}</Badge>
        {request.prioridade && <Badge tone={priorityTone(request.prioridade)}>{request.prioridade}</Badge>}
        <span className="text-sm text-zinc-500">{request.tipo === 'FULL_MARKETPLACE' ? 'Full marketplace' : 'Loja física'}</span>
      </div>

      {request.status === 'Recusada' && request.motivo_recusa && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <strong>Recusada.</strong> Motivo: {request.motivo_recusa}
        </div>
      )}

      {canResubmit && (
        <ResubmitRequest
          requestId={id}
          motivo={lastAdjust?.observacao ?? null}
          companyId={request.empresa_id ?? null}
          initialObservacoes={request.observacoes ?? null}
          initialItems={typedItems.map((i) => ({
            sku: i.sku ?? '',
            nome_produto: i.nome_produto ?? '',
            quantidade: String(i.quantidade ?? 1),
            preco_venda: null,
          }))}
        />
      )}

      {request.carga_id && (
        <Link
          href={`/cargas/${request.carga_id}`}
          className="flex flex-wrap items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm hover:bg-brand-100"
        >
          <Truck className="h-4 w-4 text-brand-700" />
          <span className="text-zinc-600">Virou a carga</span>
          <span className="font-semibold text-brand-700">{load?.codigo_interno ?? 'Abrir carga'}</span>
          {load?.status && <Badge tone={loadStatusTone(load.status)} dot>{load.status}</Badge>}
          {load?.data_agendada && <span className="text-zinc-500">Agendada para {dateTime(load.data_agendada)}</span>}
        </Link>
      )}

      <Card>
        <CardBody>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-3 xl:grid-cols-6">
            <Info label="Empresa">{request.companies?.nome ?? '-'}</Info>
            <Info label="Destino">{destino}</Info>
            <Info label="Data desejada">{dateTime(request.data_desejada)}</Info>
            <Info label="Criada em">{dateTime(request.created_at)}</Info>
            <Info label="Volume">{typedItems.length} itens · {unidades.toLocaleString('pt-BR')} un.</Info>
            {canSeeFinancial && (
              <Info label="Faturamento estimado">{request.faturamento_estimado != null ? money(Number(request.faturamento_estimado)) : '-'}</Info>
            )}
          </dl>
          {request.observacoes && (
            <p className="mt-3 border-t border-zinc-100 pt-3 text-sm text-zinc-600"><span className="text-zinc-500">Observações:</span> {request.observacoes}</p>
          )}
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Itens" description={canSeeFinancial && cmvTotal > 0 ? `CMV total: ${brl(cmvTotal)}` : undefined} />
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-medium text-zinc-500">
                    <th className="px-3 py-2">SKU</th>
                    <th className="px-3 py-2">Produto</th>
                    <th className="px-3 py-2 text-right">Qtd</th>
                    {canSeeFinancial && <th className="px-3 py-2 text-right">CMV unit.</th>}
                    {canSeeFinancial && <th className="px-3 py-2 text-right">CMV total</th>}
                  </tr>
                </thead>
                <tbody>
                  {typedItems.map((i) => (
                    <tr key={i.id} className="border-b border-zinc-50 last:border-0">
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-zinc-600">{i.sku}</td>
                      <td className="px-3 py-2 text-zinc-800">{i.nome_produto}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{i.quantidade}</td>
                      {canSeeFinancial && <td className="whitespace-nowrap px-3 py-2 text-right">{brl(i.cmv_unitario)}</td>}
                      {canSeeFinancial && <td className="whitespace-nowrap px-3 py-2 text-right">{brl(i.cmv_total)}</td>}
                    </tr>
                  ))}
                  {typedItems.length === 0 && (
                    <tr><td colSpan={canSeeFinancial ? 5 : 3} className="px-3 py-4 text-center text-zinc-400">Nenhum item ainda.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Histórico" />
            <CardBody>
              {historyRows.length === 0 ? (
                <p className="text-sm text-zinc-400">Sem histórico ainda.</p>
              ) : (
                <ol className="relative space-y-4 border-l border-zinc-200 pl-4">
                  {historyRows.map((h) => (
                    <li key={h.id} className="relative text-sm">
                      <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-brand-500" />
                      <div className="font-medium text-zinc-800">{HISTORY_LABELS[h.acao] ?? h.acao}</div>
                      <div className="text-xs text-zinc-400">{dateTime(h.created_at)}</div>
                      {h.observacao && !h.observacao.startsWith('load_id:') && (
                        <p className="mt-1 rounded-md bg-zinc-50 px-2 py-1 text-xs text-zinc-600">{h.observacao}</p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Comentários" />
            <CardBody className="space-y-3">
              <CommentForm entidade="load_request" entidadeId={id} />
              <ul className="space-y-2 text-sm">
                {((comments ?? []) as CommentRow[]).map((c) => (
                  <li key={c.id} className="rounded-lg bg-zinc-50 px-3 py-2">
                    <p className="whitespace-pre-wrap text-zinc-800">{c.texto}</p>
                    <span className="text-xs text-zinc-400">{dateTime(c.created_at)}</span>
                  </li>
                ))}
                {(comments ?? []).length === 0 && <li className="text-zinc-400">Sem comentários ainda.</li>}
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
