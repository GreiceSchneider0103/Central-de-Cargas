import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertTriangle, ArrowLeft, CheckCircle2, Circle, History, Pencil } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import type { UserProfile } from '@/lib/auth/roles';
import { CommentForm } from '@/components/comments/CommentForm';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { loadStatusTone, priorityTone } from '@/lib/ui/status-styles';
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

const dateTime = (v: string | null) =>
  v ? new Date(v).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-';
const num = (v: number | null | undefined, digits = 2) => (v == null ? '-' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: digits }));

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="mt-0.5 truncate font-medium text-zinc-800">{children}</dd>
    </div>
  );
}

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
  const unidades = typedItems.reduce((s, i) => s + (i.quantidade ?? 0), 0);
  const hasItemStatus = typedItems.some((i) => i.status_item);
  const checklistDone = checklist ? CHECKLIST_FIELDS.filter((f) => checklist[f.key]).length : 0;
  const itemCols = 4 + (canSeeFinancial ? 2 : 0) + (hasItemStatus ? 1 : 0);

  return (
    <div className="space-y-4">
      <Link href="/cargas" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800">
        <ArrowLeft className="h-4 w-4" />
        Cargas
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-zinc-900">{load.codigo_interno}</h1>
          <Badge tone={loadStatusTone(load.status)} dot>{load.status}</Badge>
          {load.prioridade && <Badge tone={priorityTone(load.prioridade)}>{load.prioridade}</Badge>}
          <span className="text-sm text-zinc-500">{load.tipo === 'FULL_MARKETPLACE' ? 'Full marketplace' : 'Loja física'}</span>
        </div>
        <div className="flex gap-2">
          <Link href={`/auditoria?registro_id=${id}`}>
            <Button variant="secondary"><History className="h-4 w-4" />Histórico</Button>
          </Link>
          <Link href={`/cargas?abrir=${id}`}>
            <Button variant="primary"><Pencil className="h-4 w-4" />Editar carga</Button>
          </Link>
        </div>
      </div>

      {load.status === 'Cancelada' && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <strong>Cancelada.</strong> Motivo: {load.motivo_cancelamento ?? '-'}
        </div>
      )}

      <Card>
        <CardBody>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-3 xl:grid-cols-6">
            <Info label="Data agendada">{dateTime(load.data_agendada)}</Info>
            <Info label="Previsão de recebimento">{dateTime(load.data_prevista_recebimento)}</Info>
            <Info label="Recebimento real">{dateTime(load.data_real_recebimento)}</Info>
            <Info label="Nº carga marketplace">{load.numero_carga_marketplace ?? '-'}</Info>
            <Info label="Código de agendamento">{load.codigo_agendamento ?? '-'}</Info>
            <Info label="Volume">{typedItems.length} itens · {unidades.toLocaleString('pt-BR')} un.</Info>
          </dl>
          {load.observacoes && (
            <p className="mt-3 border-t border-zinc-100 pt-3 text-sm text-zinc-600"><span className="text-zinc-500">Observações:</span> {load.observacoes}</p>
          )}
        </CardBody>
      </Card>

      {canSeeFinancial && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            ['Faturamento estimado', money(load.faturamento_estimado)],
            ['CMV total', money(load.cmv_total)],
            ['Frete', money(load.custo_frete)],
            ['Outros custos', money(load.outros_custos)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-card border border-zinc-200 bg-white px-4 py-3 shadow-card">
              <div className="text-xs text-zinc-500">{label}</div>
              <div className="font-semibold text-zinc-900">{value}</div>
            </div>
          ))}
          <div className="col-span-2 rounded-card border border-zinc-200 bg-white px-4 py-3 shadow-card md:col-span-1">
            <div className="text-xs text-zinc-500">Margem estimada</div>
            <div className={`font-semibold ${(load.margem_estimativa_valor ?? 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {money(load.margem_estimativa_valor)}
              <span className="ml-1 text-xs font-normal text-zinc-500">
                {load.margem_estimativa_percentual != null ? `${(load.margem_estimativa_percentual * 100).toFixed(1)}%` : 'pendente'}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Itens da carga"
            description={`Peso total: ${num(pesoTotal)} kg · Cubagem total: ${num(cubagemTotal, 3)} m³`}
          />
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-medium text-zinc-500">
                    <th className="px-3 py-2">SKU</th>
                    <th className="px-3 py-2">Nome</th>
                    <th className="px-3 py-2 text-right">Qtd</th>
                    {canSeeFinancial && <th className="px-3 py-2 text-right">CMV unit.</th>}
                    {canSeeFinancial && <th className="px-3 py-2 text-right">CMV total</th>}
                    <th className="px-3 py-2">Peso · medidas (A×L×P)</th>
                    {hasItemStatus && <th className="px-3 py-2">Status</th>}
                  </tr>
                </thead>
                <tbody>
                  {typedItems.map((i) => (
                    <tr key={i.id} className="border-b border-zinc-50 align-top last:border-0">
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-zinc-600">{i.sku}</td>
                      <td className="min-w-[12rem] px-3 py-2 text-zinc-800">{i.nome_produto}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{i.quantidade}</td>
                      {canSeeFinancial && <td className="whitespace-nowrap px-3 py-2 text-right">{money(i.cmv_unitario)}</td>}
                      {canSeeFinancial && <td className="whitespace-nowrap px-3 py-2 text-right">{money(i.cmv_total)}</td>}
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-zinc-600">
                        <div>{i.peso ? `${num(i.peso)} kg` : '-'}{i.cubagem ? ` · ${num(i.cubagem, 3)} m³` : ''}</div>
                        {(i.altura || i.largura || i.profundidade) && (
                          <div className="text-zinc-400">{num(i.altura, 1)} × {num(i.largura, 1)} × {num(i.profundidade, 1)} cm</div>
                        )}
                      </td>
                      {hasItemStatus && <td className="px-3 py-2 text-zinc-600">{i.status_item ?? '-'}</td>}
                    </tr>
                  ))}
                  {typedItems.length === 0 && (
                    <tr>
                      <td colSpan={itemCols} className="px-3 py-4 text-center text-zinc-400">Nenhum item ainda.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Checklist" description={checklist ? `${checklistDone} de ${CHECKLIST_FIELDS.length} etapas` : undefined} />
            <CardBody className="space-y-1.5">
              {checklist ? (
                CHECKLIST_FIELDS.map((field) => {
                  const done = !!checklist[field.key];
                  return (
                    <div key={field.key} className={`flex items-center gap-2 text-sm ${done ? 'text-emerald-700' : 'text-zinc-500'}`}>
                      {done ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <Circle className="h-4 w-4 shrink-0" />}
                      {field.label}
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-zinc-500">Checklist ainda não disponível para esta carga.</p>
              )}
              {checklist && !nfEmitida && (
                <p className="flex items-center gap-1 pt-1 text-xs text-amber-600"><AlertTriangle className="h-3.5 w-3.5" />NF ainda não emitida.</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Comentários" />
            <CardBody className="space-y-3">
              <CommentForm entidade="load" entidadeId={id} />
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
