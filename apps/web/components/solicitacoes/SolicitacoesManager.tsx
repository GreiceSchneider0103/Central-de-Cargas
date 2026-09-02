'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Plus, AlertTriangle } from 'lucide-react';
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

type Item = { sku: string; nome_produto: string; quantidade: number; fornecedor_origem_id?: string; cmv_unitario: number; cmv_total: number };
type NamedOption = { id: string; nome: string; tipo?: string | null };
type RequestRow = { id: string; codigo: string; tipo: string; status: string; created_at: string; carga_id?: string | null };
type ReasonAction = { id: string; kind: 'Recusada' | 'Ajuste solicitado' };

const PAGE_SIZE = 50;
const STATUS_FILTERS = [
  { label: 'Todas', value: '' },
  { label: 'Pendentes', value: 'Pendente' },
  { label: 'Em análise', value: 'Em análise' },
  { label: 'Aprovadas', value: 'Aprovada' },
  { label: 'Recusadas', value: 'Recusada' },
  { label: 'Ajuste solicitado', value: 'Ajuste solicitado' },
  { label: 'Transformadas em carga', value: 'Transformada em carga' },
  { label: 'Canceladas', value: 'Cancelada' },
];
const EMPTY_ITEM: Item = { sku: '', nome_produto: '', quantidade: 1, cmv_unitario: 0, cmv_total: 0 };

export function SolicitacoesManager({ profile }: { profile: UserProfile }) {
  const supabase = createClient();
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [companies, setCompanies] = useState<NamedOption[]>([]);
  const [stores, setStores] = useState<NamedOption[]>([]);
  const [channels, setChannels] = useState<NamedOption[]>([]);
  const [destinations, setDestinations] = useState<NamedOption[]>([]);
  const [suppliers, setSuppliers] = useState<NamedOption[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [items, setItems] = useState<Item[]>([EMPTY_ITEM]);
  const [tipo, setTipo] = useState<'LOJA_FISICA' | 'FULL_MARKETPLACE'>('LOJA_FISICA');
  const [lojaDestinoId, setLojaDestinoId] = useState('');
  const [marketplaceId, setMarketplaceId] = useState('');
  const [destinoFullId, setDestinoFullId] = useState('');
  const [empresaId, setEmpresaId] = useState('');
  const [canalId, setCanalId] = useState('');
  const [prioridade, setPrioridade] = useState('Média');
  const [dataDesejada, setDataDesejada] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const toast = useToast();
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);
  const [totalRequests, setTotalRequests] = useState(0);
  const [reasonAction, setReasonAction] = useState<ReasonAction | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [convertId, setConvertId] = useState<string | null>(null);

  const canApprove = profile.perfil === 'admin' || profile.perfil === 'gerente_estoque';
  const canSeeFinancial = ['admin', 'gerente_estoque', 'gerente_ecommerce', 'financeiro'].includes(profile.perfil);

  const load = useCallback(async () => {
    setLoadingList(true);
    const [reqs, c, s, ch, d, sup] = await Promise.all([
      (() => {
        let query = supabase.from('load_requests').select('id,codigo,tipo,status,created_at,carga_id', { count: 'exact' }).order('created_at', { ascending: false }).range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
        if (statusFilter) query = query.eq('status', statusFilter);
        return query;
      })(),
      supabase.from('companies').select('id,nome').eq('ativo', true),
      supabase.from('stores').select('id,nome').eq('ativo', true),
      supabase.from('channels').select('id,nome,tipo').eq('ativo', true),
      supabase.from('full_destinations').select('id,nome').eq('ativo', true),
      supabase.from('suppliers').select('id,nome').eq('ativo', true),
    ]);
    setRows((reqs.data ?? []) as RequestRow[]);
    setTotalRequests(reqs.count ?? 0);
    setCompanies((c.data ?? []) as NamedOption[]); setStores((s.data ?? []) as NamedOption[]); setChannels((ch.data ?? []) as NamedOption[]); setDestinations((d.data ?? []) as NamedOption[]); setSuppliers((sup.data ?? []) as NamedOption[]);
    setLoadingList(false);
  }, [supabase, page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  function updateItem(index: number, field: keyof Item, value: Item[keyof Item]) {
    const next = [...items];
    (next[index] as Record<string, unknown>)[field] = value;
    next[index].cmv_total = Number(next[index].quantidade) * Number(next[index].cmv_unitario || 0);
    setItems(next);
  }

  async function handleSkuChange(index: number, sku: string) {
    const next = [...items];
    next[index].sku = sku;
    const { data: productRows } = await supabase.rpc('get_visible_product_by_sku', { p_sku: sku });
    const product = Array.isArray(productRows) ? productRows[0] : null;
    if (product) {
      next[index].nome_produto = product.nome;
      next[index].cmv_unitario = Number(product.cmv || 0);
      next[index].cmv_total = next[index].cmv_unitario * next[index].quantidade;
    }
    setItems(next);
  }

  async function createRequest() {
    if (profile.perfil === 'gerente_ecommerce' && tipo !== 'FULL_MARKETPLACE') return toast.error('Gerente e-commerce cria apenas Full.');
    if (profile.perfil === 'vendedor_loja' && tipo !== 'LOJA_FISICA') return toast.error('Vendedor cria apenas Loja Física.');
    if (tipo === 'LOJA_FISICA' && !lojaDestinoId) return toast.error('Solicitação de loja física exige loja destino.');
    if (tipo === 'FULL_MARKETPLACE' && (!destinoFullId || (!marketplaceId && !canalId))) return toast.error('Solicitação Full exige destino e marketplace/canal.');
    if (items.some((i) => !i.sku || !i.nome_produto || i.quantidade <= 0)) return toast.error('Cada item precisa SKU, nome e quantidade.');

    const authUser = (await supabase.auth.getUser()).data.user;
    const { data: me } = await supabase.from('users_profile').select('id').eq('auth_user_id', authUser?.id ?? '').single();
    if (!me) return toast.error('Perfil do usuário não encontrado.');
    const code = `REQ-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const { data: req, error } = await supabase.from('load_requests').insert({ codigo: code, tipo, empresa_id: empresaId || null, canal_id: canalId || null, marketplace_id: marketplaceId || null, destino_full_id: destinoFullId || null, loja_destino_id: lojaDestinoId || null, prioridade, data_desejada: dataDesejada || null, status: 'Pendente', solicitante_id: me.id, observacoes: observacoes || null }).select('id').single();
    if (error) return toast.error(error.message);

    const { error: itemErr } = await supabase.from('load_request_items').insert(items.map((i) => ({ ...i, request_id: req.id })));
    if (itemErr) return toast.error(itemErr.message);

    await supabase.from('load_request_history').insert({ request_id: req.id, acao: 'CRIADA', status_novo: 'Pendente', autor_profile_id: me.id });
    setItems([EMPTY_ITEM]);
    setPrioridade('Média');
    setDataDesejada('');
    setObservacoes('');
    setShowCreate(false);
    toast.success('Solicitação criada com sucesso.');
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
    toast.success(`Carga criada com sucesso: ${j.loadId}`);
    await load();
  }

  const totalRequestPages = Math.max(1, Math.ceil(totalRequests / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-left text-xs font-medium text-zinc-500">
                    <th className="py-2">Código</th>
                    <th className="py-2">Tipo</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Criada em</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-zinc-50 last:border-0">
                      <td className="py-2"><Link className="font-medium text-brand-600 hover:text-brand-700" href={`/solicitacoes/${r.id}`}>{r.codigo}</Link></td>
                      <td className="py-2 text-zinc-600">{r.tipo === 'FULL_MARKETPLACE' ? 'Full' : 'Loja'}</td>
                      <td className="py-2"><Badge tone={requestStatusTone(r.status)} dot>{r.status}</Badge></td>
                      <td className="py-2 text-zinc-500">{new Date(r.created_at).toLocaleString('pt-BR')}</td>
                      <td className="space-x-3 py-2 text-right whitespace-nowrap">
                        {canApprove && r.status !== 'Aprovada' && r.status !== 'Recusada' && r.status !== 'Transformada em carga' && (
                          <>
                            <button className="font-medium text-emerald-700 hover:text-emerald-800" onClick={() => changeStatus(r.id, 'Aprovada')}>Aprovar</button>
                            <button className="font-medium text-rose-700 hover:text-rose-800" onClick={() => setReasonAction({ id: r.id, kind: 'Recusada' })}>Recusar</button>
                            <button className="font-medium text-amber-700 hover:text-amber-800" onClick={() => setReasonAction({ id: r.id, kind: 'Ajuste solicitado' })}>Ajuste</button>
                          </>
                        )}
                        {canApprove && r.status === 'Aprovada' && !r.carga_id && <button className="font-medium text-brand-600 hover:text-brand-700" onClick={() => setConvertId(r.id)}>Transformar em carga</button>}
                        {r.carga_id && <Link className="font-medium text-brand-600 hover:text-brand-700" href={`/cargas/${r.carga_id}`}>Abrir carga</Link>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-zinc-100 pt-3 text-sm">
            <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Anterior</Button>
            <span className="text-zinc-500">Página {page + 1} de {totalRequestPages} ({totalRequests} solicitações)</span>
            <Button variant="secondary" size="sm" disabled={page + 1 >= totalRequestPages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
          </div>
        </CardBody>
      </Card>

      <Dialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Nova solicitação"
        size="lg"
        footer={<Button variant="primary" onClick={createRequest}>Criar solicitação</Button>}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <FieldGroup label="Tipo">
              <Select value={tipo} onChange={(e) => setTipo(e.target.value as 'LOJA_FISICA' | 'FULL_MARKETPLACE')}>
                <option value="LOJA_FISICA">Loja física</option>
                <option value="FULL_MARKETPLACE">Full Marketplace</option>
              </Select>
            </FieldGroup>
            <FieldGroup label="Empresa">
              <Select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
                <option value="">Selecionar</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </Select>
            </FieldGroup>
            <FieldGroup label="Canal">
              <Select value={canalId} onChange={(e) => setCanalId(e.target.value)}>
                <option value="">Selecionar</option>
                {channels.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </Select>
            </FieldGroup>
            {tipo === 'LOJA_FISICA' ? (
              <FieldGroup label="Loja destino">
                <Select value={lojaDestinoId} onChange={(e) => setLojaDestinoId(e.target.value)}>
                  <option value="">Selecionar</option>
                  {stores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </Select>
              </FieldGroup>
            ) : (
              <>
                <FieldGroup label="Marketplace">
                  <Select value={marketplaceId} onChange={(e) => setMarketplaceId(e.target.value)}>
                    <option value="">Selecionar</option>
                    {channels.filter((c) => c.tipo === 'Marketplace Full').map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
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
            <FieldGroup label="Prioridade">
              <Select value={prioridade} onChange={(e) => setPrioridade(e.target.value)}>
                <option value="Baixa">Baixa</option>
                <option value="Média">Média</option>
                <option value="Alta">Alta</option>
                <option value="Urgente">Urgente</option>
              </Select>
            </FieldGroup>
            <FieldGroup label="Data desejada">
              <Input type="datetime-local" value={dataDesejada} onChange={(e) => setDataDesejada(e.target.value)} />
            </FieldGroup>
            <FieldGroup label="Observações" className="md:col-span-3">
              <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
            </FieldGroup>
          </div>

          <div className="border-t border-zinc-100 pt-4">
            <h3 className="mb-2 text-sm font-semibold text-zinc-700">Itens</h3>
            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-1 gap-2 md:grid-cols-6">
                  <FieldGroup label="SKU"><Input value={item.sku} onChange={(e) => handleSkuChange(idx, e.target.value)} /></FieldGroup>
                  <FieldGroup label="Nome" className="md:col-span-2"><Input value={item.nome_produto} onChange={(e) => updateItem(idx, 'nome_produto', e.target.value)} /></FieldGroup>
                  <FieldGroup label="Quantidade"><Input type="number" value={item.quantidade} onChange={(e) => updateItem(idx, 'quantidade', Number(e.target.value))} /></FieldGroup>
                  <FieldGroup label="Fornecedor">
                    <Select value={item.fornecedor_origem_id || ''} onChange={(e) => updateItem(idx, 'fornecedor_origem_id', e.target.value)}>
                      <option value="">Selecionar</option>
                      {suppliers.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                    </Select>
                  </FieldGroup>
                  {canSeeFinancial && <FieldGroup label="CMV unitário"><Input type="number" value={item.cmv_unitario} onChange={(e) => updateItem(idx, 'cmv_unitario', Number(e.target.value))} /></FieldGroup>}
                  {canSeeFinancial && Number(item.cmv_unitario) <= 0 && <p className="col-span-6 flex items-center gap-1 text-xs text-amber-600"><AlertTriangle className="h-3.5 w-3.5" />Produto sem CMV cadastrado. Informe manualmente.</p>}
                </div>
              ))}
            </div>
            <Button variant="secondary" size="sm" className="mt-2" onClick={() => setItems((prev) => [...prev, EMPTY_ITEM])}>+ Item</Button>
          </div>
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
        <p className="text-sm text-zinc-600">Essa solicitação vai virar uma carga oficial, com os mesmos itens. Deseja continuar?</p>
      </Dialog>
    </div>
  );
}
