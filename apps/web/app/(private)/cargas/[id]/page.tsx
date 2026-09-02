import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Circle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import type { UserProfile } from '@/lib/auth/roles';
import { CommentForm } from '@/components/comments/CommentForm';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { loadStatusTone } from '@/lib/ui/status-styles';
import { money } from '@/lib/ui/format';
import { CHECKLIST_FIELDS } from '@/lib/loads/checklist';

type VisibleLoad = {
  id: string;
  codigo_interno: string | null;
  numero_carga_marketplace: string | null;
  codigo_agendamento: string | null;
  tipo: string | null;
  status: string | null;
  prioridade: string | null;
  data_agendada: string | null;
  data_prevista_recebimento: string | null;
  data_real_recebimento: string | null;
  custo_frete: number | null;
  outros_custos: number | null;
  faturamento_estimado: number | null;
  cmv_total: number | null;
  margem_estimativa_valor: number | null;
  margem_estimativa_percentual: number | null;
  observacoes: string | null;
  motivo_cancelamento: string | null;
};

type VisibleLoadItem = {
  id: string;
  sku: string | null;
  nome_produto: string | null;
  quantidade: number | null;
  cmv_unitario: number | null;
  cmv_total: number | null;
  peso: number | null;
  altura: number | null;
  largura: number | null;
  profundidade: number | null;
  cubagem: number | null;
  status_item: string | null;
};

type ChecklistRow = Record<string, boolean | null | undefined>;
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
  if (!load) redirect('/cargas');

  const { data: items } = await supabase.rpc('get_visible_load_items', { p_load_id: id });
  const { data: checklist } = await supabase.from('load_checklists').select('*').eq('load_id', id).single<ChecklistRow>();
  const { data: comments } = await supabase
    .from('comments')
    .select('id,texto,created_at')
    .eq('entidade', 'load')
    .eq('entidade_id', id)
    .order('created_at', { ascending: false })
    .limit(20);

  const typedItems = (items ?? []) as VisibleLoadItem[];
  const nfEmitida = checklist?.nf_emitida;

  const pesoTotal = typedItems.reduce((s, i) => s + (i.peso ?? 0) * (i.quantidade ?? 0), 0);
  const cubagemTotal = typedItems.reduce((s, i) => s + (i.cubagem ?? 0) * (i.quantidade ?? 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-zinc-900">{load.codigo_interno}</h1>
          <Badge tone={loadStatusTone(load.status)} dot>{load.status}</Badge>
          {load.prioridade && <span className="text-sm text-zinc-500">Prioridade: {load.prioridade}</span>}
        </div>
        <Link href="/cargas"><Button variant="secondary">Editar na lista de cargas</Button></Link>
      </div>

      <Card>
        <CardBody className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
          <p><span className="text-zinc-500">Nº carga marketplace:</span> <span className="font-medium">{load.numero_carga_marketplace ?? '-'}</span></p>
          <p><span className="text-zinc-500">Código de agendamento:</span> <span className="font-medium">{load.codigo_agendamento ?? '-'}</span></p>
          <p><span className="text-zinc-500">Data agendada:</span> <span className="font-medium">{load.data_agendada ? new Date(load.data_agendada).toLocaleString('pt-BR') : '-'}</span></p>
          <p><span className="text-zinc-500">Prev. recebimento:</span> <span className="font-medium">{load.data_prevista_recebimento ? new Date(load.data_prevista_recebimento).toLocaleString('pt-BR') : '-'}</span></p>
          <p><span className="text-zinc-500">Real recebimento:</span> <span className="font-medium">{load.data_real_recebimento ? new Date(load.data_real_recebimento).toLocaleString('pt-BR') : '-'}</span></p>
          <p><span className="text-zinc-500">Observações:</span> <span className="font-medium">{load.observacoes ?? '-'}</span></p>
          {load.status === 'Cancelada' && (
            <p className="text-rose-700 md:col-span-3"><span className="text-rose-500">Motivo do cancelamento:</span> {load.motivo_cancelamento ?? '-'}</p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Itens da carga"
          description={`Peso total: ${pesoTotal.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg · Cubagem total: ${cubagemTotal.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} m³`}
        />
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left text-xs font-medium text-zinc-500">
                  <th className="px-4 py-2">SKU</th>
                  <th className="px-4 py-2">Nome</th>
                  <th className="px-4 py-2">Qtd</th>
                  {canSeeFinancial && <th className="px-4 py-2">CMV unit.</th>}
                  {canSeeFinancial && <th className="px-4 py-2">CMV total</th>}
                  <th className="px-4 py-2">Peso</th>
                  <th className="px-4 py-2">Dimensões (A×L×P)</th>
                  <th className="px-4 py-2">Cubagem</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {typedItems.map((i) => (
                  <tr key={i.id} className="border-b border-zinc-50 last:border-0">
                    <td className="px-4 py-2">{i.sku}</td>
                    <td className="px-4 py-2">{i.nome_produto}</td>
                    <td className="px-4 py-2">{i.quantidade}</td>
                    {canSeeFinancial && <td className="px-4 py-2">{i.cmv_unitario ?? '-'}</td>}
                    {canSeeFinancial && <td className="px-4 py-2">{i.cmv_total ?? '-'}</td>}
                    <td className="px-4 py-2">{i.peso ?? '-'}</td>
                    <td className="px-4 py-2">{i.altura ?? '-'} × {i.largura ?? '-'} × {i.profundidade ?? '-'}</td>
                    <td className="px-4 py-2">{i.cubagem ?? '-'}</td>
                    <td className="px-4 py-2">{i.status_item ?? '-'}</td>
                  </tr>
                ))}
                {typedItems.length === 0 && (
                  <tr>
                    <td colSpan={canSeeFinancial ? 9 : 7} className="px-4 py-4 text-center text-zinc-400">Sem itens.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {canSeeFinancial && (
        <Card>
          <CardBody className="grid grid-cols-2 gap-4 text-sm md:grid-cols-5">
            <div>
              <div className="text-xs text-zinc-500">Faturamento estimado</div>
              <div className="font-semibold">{money(load.faturamento_estimado)}</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">CMV total</div>
              <div className="font-semibold">{money(load.cmv_total)}</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">Custo de frete</div>
              <div className="font-semibold">{money(load.custo_frete)}</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">Outros custos</div>
              <div className="font-semibold">{money(load.outros_custos)}</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">Margem estimada</div>
              <div className={`font-semibold ${(load.margem_estimativa_valor ?? 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {money(load.margem_estimativa_valor)}
                {load.margem_estimativa_percentual !== null && load.margem_estimativa_percentual !== undefined
                  ? ` (${(load.margem_estimativa_percentual * 100).toFixed(2)}%)`
                  : ' (pendente)'}
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="Checklist operacional" />
        <CardBody>
          {checklist ? (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {CHECKLIST_FIELDS.map((field) => {
                const done = !!checklist[field.key];
                return (
                  <div key={field.key} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${done ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-zinc-200 text-zinc-500'}`}>
                    {done ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                    {field.label}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Checklist ainda não disponível para esta carga.</p>
          )}
          {!nfEmitida && (
            <p className="mt-3 flex items-center gap-1 text-xs text-amber-600"><AlertTriangle className="h-3.5 w-3.5" />Atenção: NF ainda não emitida.</p>
          )}
          <p className="mt-3 text-xs text-zinc-500">
            Para marcar etapas do checklist, editar itens, financeiro ou finalizar/cancelar a carga, use o painel em{' '}
            <Link href="/cargas" className="text-brand-600">/cargas</Link>.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Comentários" />
        <CardBody className="space-y-3">
          <CommentForm entidade="load" entidadeId={id} />
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
        <CardHeader title="Histórico de alterações" />
        <CardBody>
          <p className="text-sm text-zinc-600">
            Consulte todas as alterações desta carga em{' '}
            <Link href={`/auditoria?tabela=loads&registro_id=${id}`} className="text-brand-600">
              Auditoria filtrada por esta carga
            </Link>.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
