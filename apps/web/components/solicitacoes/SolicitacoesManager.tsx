'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, MessageSquareWarning, Plus, Truck, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { UserProfile } from '@/lib/auth/roles';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Input, Select, Textarea, FieldGroup } from '@/components/ui/Field';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';
import { requestStatusTone } from '@/lib/ui/status-styles';
import { translateError } from '@/lib/ui/error-messages';
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '@/lib/ui/datetime';
import { EMPTY_NEW_LOAD_ITEM, NewLoadItemsEditor, newLoadItemsRevenue, type NewLoadItem } from '@/components/cargas/NewLoadItemsEditor';

type LoadType = 'LOJA_FISICA' | 'FULL_MARKETPLACE';
type NamedOption = { id: string; nome: string; tipo?: string | null };
type RequestRow = {
  id: string;
  codigo: string;
  tipo: string;
  status: string;
  created_at: string;
  data_desejada: string | null;
  prioridade?: string | null;
  carga_id?: string | null;
  motivo_recusa?: string | null;
  stores?: { nome: string } | null;
  full_destinations?: { nome: string } | null;
  load_request_items?: { count: number }[];
};
type ReasonAction = { id: string; kind: 'Recusada' | 'Ajuste solicitado' };

const PAGE_SIZE = 50;

const shortDate = (v: string | null | undefined, withTime = false) =>
  v
    ? new Date(v).toLocaleString('pt-BR', withTime
      ? { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }
      : { day: '2-digit', month: '2-digit', year: '2-digit' })
    : '-';
const iconButton = 'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium';
const STATUS_FILTERS = [
  { label: 'Todas', value: '' },
  { label: 'Pendentes', value: 'Pendente' },
  { label: 'Em análise', value: 'Em análise' },
  { label: 'Ajuste solicitado', value: 'Ajuste solicitado' },
  { label: 'Aprovadas', value: 'Aprovada' },
  { label: 'Transformadas em carga', value: 'Transformada em carga' },
  { label: 'Recusadas', value: 'Recusada' },
  { label: 'Canceladas', value: 'Cancelada' },
];

// Quem só pode pedir um tipo de carga já abre o formulário com ele fixo.
function lockedTypeFor(perfil: UserProfile['perfil']): LoadType | null {
  if (perfil === 'vendedor_loja') return 'LOJA_FISICA';
  if (perfil === 'gerente_ecommerce') return 'FULL_MARKETPLACE';
  return null;
}

export function SolicitacoesManager({ profile }: { profile: UserProfile }) {
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();
  const lockedType = lockedTypeFor(profile.perfil);
  const lockedStoreId = profile.perfil === 'vendedor_loja' && profile.loja_id ? profile.loja_id : null;
  const canApprove = profile.perfil === 'admin' || profile.perfil === 'gerente_estoque';
  const canSeeFinancial = ['admin', 'gerente_estoque', 'gerente_ecommerce', 'financeiro'].includes(profile.perfil);

  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [companies, setCompanies] = useState<NamedOption[]>([]);
  const [stores, setStores] = useState<NamedOption[]>([]);
  const [channels, setChannels] = useState<NamedOption[]>([]);
  const [destinations, setDestinations] = useState<NamedOption[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [onlyMine, setOnlyMine] = useState(!canApprove);
  const [page, setPage] = useState(0);
  const [totalRequests, setTotalRequests] = useState(0);
  const [reasonAction, setReasonAction] = useState<ReasonAction | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [convertId, setConvertId] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tipo, setTipo] = useState<LoadType>(lockedType ?? 'LOJA_FISICA');
  const [empresaId, setEmpresaId] = useState(profile.empresa_id ?? '');
  const [lojaDestinoId, setLojaDestinoId] = useState(lockedStoreId ?? '');
  const [marketplaceId, setMarketplaceId] = useState('');
  const [destinoFullId, setDestinoFullId] = useState('');
  const [prioridade, setPrioridade] = useState('Média');
  const [dataDesejada, setDataDesejada] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [items, setItems] = useState<NewLoadItem[]>([EMPTY_NEW_LOAD_ITEM]);
  const [faturamentoManual, setFaturamentoManual] = useState(false);
  const [faturamentoDigitado, setFaturamentoDigitado] = useState('');

  const suggestedRevenue = newLoadItemsRevenue(items);
  const faturamentoEstimado = faturamentoManual ? faturamentoDigitado : suggestedRevenue > 0 ? suggestedRevenue.toFixed(2) : '';
  const storeChannel = channels.find((c) => c.tipo === 'Loja física') ?? channels.find((c) => c.tipo === 'Transferência interna');
  const marketplaces = channels.filter((c) => c.tipo === 'Marketplace Full');

  const load = useCallback(async () => {
    setLoadingList(true);
    let query = supabase
      .from('load_requests')
      .select('id,codigo,tipo,status,created_at,data_desejada,prioridade,carga_id,motivo_recusa,stores(nome),full_destinations(nome),load_request_items(count)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    if (statusFilter) query = query.eq('status', statusFilter);
    if (onlyMine) query = query.eq('solicitante_id', profile.id);
    const [reqs, c, s, ch, d] = await Promise.all([
      query,
      supabase.from('companies').select('id,nome').eq('ativo', true).order('nome'),
      supabase.from('stores').select('id,nome').eq('ativo', true).order('nome'),
      supabase.from('channels').select('id,nome,tipo').eq('ativo', true).order('nome'),
      supabase.from('full_destinations').select('id,nome').eq('ativo', true).order('nome'),
    ]);
    setRows((reqs.data ?? []) as unknown as RequestRow[]);
    setTotalRequests(reqs.count ?? 0);
    setCompanies((c.data ?? []) as NamedOption[]);
    setStores((s.data ?? []) as NamedOption[]);
    setChannels((ch.data ?? []) as NamedOption[]);
    setDestinations((d.data ?? []) as NamedOption[]);
    setLoadingList(false);
  }, [supabase, page, statusFilter, onlyMine, profile.id]);

  useEffect(() => { load(); }, [load]);

  function resetForm() {
    setTipo(lockedType ?? 'LOJA_FISICA');
    setEmpresaId(profile.empresa_id ?? '');
    setLojaDestinoId(lockedStoreId ?? '');
    setMarketplaceId('');
    setDestinoFullId('');
    setPrioridade('Média');
    setDataDesejada('');
    setObservacoes('');
    setItems([EMPTY_NEW_LOAD_ITEM]);
    setFaturamentoManual(false);
    setFaturamentoDigitado('');
  }

  async function createRequest() {
    const filled = items.filter((i) => i.sku.trim() || i.nome_produto.trim());
    if (!empresaId) return toast.error('Selecione a empresa.');
    if (tipo === 'LOJA_FISICA' && !lojaDestinoId) return toast.error('Selecione a loja de destino.');
    if (tipo === 'FULL_MARKETPLACE' && (!marketplaceId || !destinoFullId)) return toast.error('Selecione o marketplace e o destino Full.');
    if (filled.length === 0) return toast.error('Adicione ao menos um item.');
    if (filled.some((i) => !i.sku.trim() || !i.nome_produto.trim() || Number(i.quantidade || 0) <= 0)) {
      return toast.error('Cada item precisa de SKU, nome e quantidade maior que zero.');
    }

    setSaving(true);
    const code = `REQ-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const canalId = tipo === 'FULL_MARKETPLACE' ? marketplaceId : storeChannel?.id ?? null;
    const { data: req, error } = await supabase
      .from('load_requests')
      .insert({
        codigo: code,
        tipo,
        empresa_id: empresaId,
        canal_id: canalId,
        marketplace_id: tipo === 'FULL_MARKETPLACE' ? marketplaceId : null,
        destino_full_id: tipo === 'FULL_MARKETPLACE' ? destinoFullId : null,
        loja_destino_id: tipo === 'LOJA_FISICA' ? lojaDestinoId : null,
        prioridade,
        data_desejada: dataDesejada || null,
        status: 'Pendente',
        solicitante_id: profile.id,
        observacoes: observacoes || null,
        faturamento_estimado: canSeeFinancial && faturamentoEstimado ? Number(faturamentoEstimado) : null,
      })
      .select('id')
      .single();
    if (error || !req) {
      setSaving(false);
      return toast.error(translateError(error?.message, 'Erro ao criar a solicitação.'));
    }

    const { error: itemErr } = await supabase.from('load_request_items').insert(
      filled.map((i) => ({ request_id: req.id, sku: i.sku.trim(), nome_produto: i.nome_produto.trim(), quantidade: Number(i.quantidade) })),
    );
    if (itemErr) {
      setSaving(false);
      return toast.error(translateError(itemErr.message, 'Erro ao salvar os itens da solicitação.'));
    }

    await supabase.from('load_request_history').insert({ request_id: req.id, acao: 'CRIADA', status_novo: 'Pendente', autor_profile_id: profile.id });
    setSaving(false);
    resetForm();
    setShowCreate(false);
    toast.success(`Solicitação ${code} enviada para aprovação.`);
    await load();
  }

  async function changeStatus(id: string, status: string, motivo?: string) {
    if (!canApprove) return;
    const url = status === 'Aprovada' ? `/api/load-requests/${id}/approve` : status === 'Recusada' ? `/api/load-requests/${id}/reject` : `/api/load-requests/${id}/request-adjust`;
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ motivo }) });
    if (!res.ok) { const j = await res.json(); toast.error(translateError(j.error, 'Não foi possível atualizar a solicitação.')); return; }
    toast.success(`Solicitação marcada como "${status}".`);
    await load();
  }

  async function confirmReason() {
    if (!reasonAction || !reasonText.trim()) return;
    await changeStatus(reasonAction.id, reasonAction.kind, reasonText);
    setReasonAction(null);
    setReasonText('');
  }

  async function confirmConvert() {
    if (!convertId) return;
    const res = await fetch(`/api/load-requests/${convertId}/convert`, { method: 'POST' });
    const j = await res.json();
    setConvertId(null);
    if (!res.ok) { toast.error(translateError(j.error, 'Erro na conversão.')); return; }
    toast.success(`Carga ${j.codigoInterno ?? ''} criada a partir da solicitação.`);
    await load();
  }

  const filledItems = items.filter((i) => i.sku.trim() || i.nome_produto.trim());
  const filledItemsCount = filledItems.length;
  const filledUnits = filledItems.reduce((sum, i) => sum + Number(i.quantidade || 0), 0);
  const totalRequestPages = Math.max(1, Math.ceil(totalRequests / PAGE_SIZE));
  const rowActions = (r: RequestRow) => (
    <>
      {canApprove && ['Pendente', 'Em análise', 'Ajuste solicitado'].includes(r.status) && (
        <>
          <button title="Aprovar" className={cn(iconButton, 'text-emerald-700 hover:bg-emerald-50')} onClick={() => changeStatus(r.id, 'Aprovada')}>
            <Check className="h-3.5 w-3.5" />Aprovar
          </button>
          <button title="Recusar" aria-label="Recusar" className={cn(iconButton, 'text-rose-700 hover:bg-rose-50')} onClick={() => setReasonAction({ id: r.id, kind: 'Recusada' })}>
            <X className="h-3.5 w-3.5" />
            <span className="md:hidden">Recusar</span>
          </button>
          <button title="Pedir ajuste" aria-label="Pedir ajuste" className={cn(iconButton, 'text-amber-700 hover:bg-amber-50')} onClick={() => setReasonAction({ id: r.id, kind: 'Ajuste solicitado' })}>
            <MessageSquareWarning className="h-3.5 w-3.5" />
            <span className="md:hidden">Ajuste</span>
          </button>
        </>
      )}
      {canApprove && r.status === 'Aprovada' && !r.carga_id && (
        <button title="Transformar em carga" className={cn(iconButton, 'text-brand-600 hover:bg-brand-50')} onClick={() => setConvertId(r.id)}>
          <Truck className="h-3.5 w-3.5" />Gerar carga
        </button>
      )}
      {r.carga_id && (
        <Link title="Acompanhar carga" className={cn(iconButton, 'text-brand-600 hover:bg-brand-50')} href={`/cargas/${r.carga_id}`}>
          <Truck className="h-3.5 w-3.5" />Ver carga
        </Link>
      )}
    </>
  );
  const destinationLabel = (r: RequestRow) =>
    r.tipo === 'FULL_MARKETPLACE' ? `Full · ${r.full_destinations?.nome ?? '-'}` : `Loja · ${r.stores?.nome ?? '-'}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={onlyMine} onChange={(e) => { setOnlyMine(e.target.checked); setPage(0); }} />
          Só as minhas solicitações
        </label>
        <Button variant="primary" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" />
          Nova solicitação
        </Button>
      </div>

      <Card>
        <CardBody className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.label}
                className={cn('rounded-full px-3 py-1 text-xs font-medium', statusFilter === filter.value ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200')}
                onClick={() => { setStatusFilter(filter.value); setPage(0); }}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {loadingList ? (
            <SkeletonRows rows={6} />
          ) : rows.length === 0 ? (
            <EmptyState title="Nenhuma solicitação encontrada" description="Ajuste os filtros ou crie uma nova solicitação." />
          ) : (
            <>
            {/* Celular: um cartão por solicitação, com as ações embaixo. */}
            <ul className="-mx-4 divide-y divide-zinc-100 border-t border-zinc-100 md:hidden">
              {rows.map((r) => (
                <li key={r.id} className="space-y-1.5 px-4 py-3">
                  <Link href={`/solicitacoes/${r.id}`} className="block space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-brand-700">{r.codigo}</span>
                      <Badge tone={requestStatusTone(r.status)} dot>{r.status}</Badge>
                    </div>
                    <p className="text-sm text-zinc-600">{destinationLabel(r)}</p>
                    <p className="flex flex-wrap gap-x-3 text-xs text-zinc-500">
                      <span>{r.load_request_items?.[0]?.count ?? 0} itens</span>
                      <span>Desejada {shortDate(r.data_desejada)}</span>
                      {r.prioridade && <span>{r.prioridade}</span>}
                    </p>
                    {r.status === 'Recusada' && r.motivo_recusa && <p className="text-xs text-rose-700">{r.motivo_recusa}</p>}
                    {r.status === 'Ajuste solicitado' && <p className="text-xs font-medium text-amber-700">Ver ajuste e reenviar →</p>}
                  </Link>
                  <div className="flex flex-wrap gap-1">{rowActions(r)}</div>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-left text-xs font-medium text-zinc-500">
                    <th className="py-2 pr-3">Código</th>
                    <th className="py-2 pr-3">Destino</th>
                    <th className="py-2 pr-3 text-right">Itens</th>
                    <th className="py-2 pr-3">Prioridade</th>
                    <th className="py-2 pr-3">Desejada</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Criada em</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50">
                      <td className="whitespace-nowrap py-2 pr-3"><Link className="font-medium text-brand-600 hover:text-brand-700" href={`/solicitacoes/${r.id}`}>{r.codigo}</Link></td>
                      <td className="py-2 pr-3 text-zinc-600">{destinationLabel(r)}</td>
                      <td className="py-2 pr-3 text-right text-zinc-600">{r.load_request_items?.[0]?.count ?? 0}</td>
                      <td className="py-2 pr-3 text-zinc-600">{r.prioridade ?? '-'}</td>
                      <td className="whitespace-nowrap py-2 pr-3 text-zinc-600">{shortDate(r.data_desejada)}</td>
                      <td className="py-2 pr-3">
                        <Badge tone={requestStatusTone(r.status)} dot>{r.status}</Badge>
                        {r.status === 'Recusada' && r.motivo_recusa && <div className="mt-1 max-w-[16rem] truncate text-xs text-zinc-500" title={r.motivo_recusa}>{r.motivo_recusa}</div>}
                        {r.status === 'Ajuste solicitado' && (
                          <div className="mt-1 text-xs"><Link className="text-amber-700 hover:underline" href={`/solicitacoes/${r.id}`}>Ver ajuste e reenviar</Link></div>
                        )}
                      </td>
                      <td className="whitespace-nowrap py-2 pr-3 text-zinc-500">{shortDate(r.created_at, true)}</td>
                      <td className="py-2 text-right">
                        <div className="inline-flex flex-wrap justify-end gap-1">{rowActions(r)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}

          <div className="flex items-center justify-between gap-2 border-t border-zinc-100 pt-3 text-sm">
            <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Anterior</Button>
            <span className="text-center text-xs text-zinc-500 sm:text-sm">Página {page + 1} de {totalRequestPages} ({totalRequests} solicitações)</span>
            <Button variant="secondary" size="sm" disabled={page + 1 >= totalRequestPages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
          </div>
        </CardBody>
      </Card>

      <Dialog
        open={showCreate}
        onClose={() => !saving && setShowCreate(false)}
        title="Nova solicitação de carga"
        description="Depois de enviada, a solicitação vai para aprovação da gerência de cargas. Você acompanha o status nesta tela."
        size="xl"
        footer={
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-zinc-500">
              {filledItemsCount} {filledItemsCount === 1 ? 'item' : 'itens'} · {filledUnits.toLocaleString('pt-BR')} un.
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setShowCreate(false)} disabled={saving}>Cancelar</Button>
              <Button variant="primary" onClick={createRequest} disabled={saving}>{saving ? 'Enviando...' : 'Enviar para aprovação'}</Button>
            </div>
          </div>
        }
      >
        <div className="space-y-6">
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">1. Para onde</h3>
            <div className="inline-flex overflow-hidden rounded-lg border border-zinc-300 text-sm">
              {([['LOJA_FISICA', 'Loja física (transferência)'], ['FULL_MARKETPLACE', 'Full marketplace']] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  disabled={lockedType !== null && lockedType !== value}
                  onClick={() => setTipo(value as LoadType)}
                  className={cn(
                    'px-4 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-40',
                    tipo === value ? 'bg-brand-600 text-white' : 'bg-white text-zinc-600 hover:bg-zinc-50',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <FieldGroup label="Empresa">
                <Select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
                  <option value="">Selecionar</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </Select>
              </FieldGroup>
              {tipo === 'LOJA_FISICA' ? (
                <FieldGroup label="Loja de destino">
                  <Select value={lojaDestinoId} onChange={(e) => setLojaDestinoId(e.target.value)} disabled={lockedStoreId !== null}>
                    <option value="">Selecionar</option>
                    {stores.map((st) => <option key={st.id} value={st.id}>{st.nome}</option>)}
                  </Select>
                </FieldGroup>
              ) : (
                <>
                  <FieldGroup label="Marketplace">
                    <Select value={marketplaceId} onChange={(e) => setMarketplaceId(e.target.value)}>
                      <option value="">Selecionar</option>
                      {marketplaces.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </Select>
                  </FieldGroup>
                  <FieldGroup label="Destino Full">
                    <Select value={destinoFullId} onChange={(e) => setDestinoFullId(e.target.value)}>
                      <option value="">Selecionar</option>
                      {destinations.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
                    </Select>
                  </FieldGroup>
                </>
              )}
              <FieldGroup label={tipo === 'FULL_MARKETPLACE' ? 'Data desejada no Full' : 'Data desejada de entrega'}>
                <Input
                  type="datetime-local"
                  value={toDatetimeLocalValue(dataDesejada)}
                  onChange={(e) => setDataDesejada(fromDatetimeLocalValue(e.target.value) ?? '')}
                />
              </FieldGroup>
              <FieldGroup label="Prioridade">
                <Select value={prioridade} onChange={(e) => setPrioridade(e.target.value)}>
                  <option value="Baixa">Baixa</option>
                  <option value="Média">Média</option>
                  <option value="Alta">Alta</option>
                  <option value="Urgente">Urgente</option>
                </Select>
              </FieldGroup>
            </div>
          </section>

          <section className="space-y-2 border-t border-zinc-100 pt-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">2. Itens</h3>
            <p className="text-xs text-zinc-500">
              Busque pelo SKU ou nome, ou use “Colar lista / planilha” para enviar muitos itens de uma vez (SKU e quantidade).
            </p>
            <NewLoadItemsEditor items={items} onChange={setItems} companyId={empresaId} />
          </section>

          <section className="grid grid-cols-1 gap-3 border-t border-zinc-100 pt-5 md:grid-cols-3">
            {canSeeFinancial && (
              <FieldGroup label="Faturamento estimado">
                <Input
                  type="number"
                  value={faturamentoEstimado}
                  onChange={(e) => {
                    setFaturamentoManual(true);
                    setFaturamentoDigitado(e.target.value);
                  }}
                />
                {!faturamentoManual && suggestedRevenue > 0 && <span className="text-xs text-zinc-500">Soma do preço de venda × quantidade</span>}
              </FieldGroup>
            )}
            <FieldGroup label="Observações" className={canSeeFinancial ? 'md:col-span-2' : 'md:col-span-3'}>
              <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Algo que a gerência ou o estoque precisa saber?" />
            </FieldGroup>
          </section>
        </div>
      </Dialog>

      <Dialog
        open={!!reasonAction}
        onClose={() => setReasonAction(null)}
        title={reasonAction?.kind === 'Recusada' ? 'Recusar solicitação' : 'Solicitar ajuste'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setReasonAction(null)}>Cancelar</Button>
            <Button variant={reasonAction?.kind === 'Recusada' ? 'danger' : 'primary'} disabled={!reasonText.trim()} onClick={confirmReason}>Confirmar</Button>
          </>
        }
      >
        <FieldGroup label="Motivo">
          <Textarea value={reasonText} onChange={(e) => setReasonText(e.target.value)} placeholder="Explique o motivo para quem solicitou..." />
        </FieldGroup>
      </Dialog>

      <Dialog
        open={!!convertId}
        onClose={() => setConvertId(null)}
        title="Transformar em carga"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConvertId(null)}>Cancelar</Button>
            <Button variant="primary" onClick={confirmConvert}>Confirmar</Button>
          </>
        }
      >
        <p className="text-sm text-zinc-600">
          Essa solicitação vai virar uma carga oficial com os mesmos itens. CMV, fornecedor, peso e medidas vêm do cadastro dos produtos, e a data desejada vira a data agendada.
        </p>
      </Dialog>
    </div>
  );
}
