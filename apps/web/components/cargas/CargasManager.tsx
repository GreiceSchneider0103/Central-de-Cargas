'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Plus, AlertTriangle, Pencil, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { UserProfile } from '@/lib/auth/roles';
import { LOAD_STATUSES } from '@/lib/loads/statuses';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Input, Select, Textarea, FieldGroup } from '@/components/ui/Field';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { loadStatusTone } from '@/lib/ui/status-styles';
import { translateError } from '@/lib/ui/error-messages';
import { cn } from '@/lib/utils';
import { toDatetimeLocalValue, fromDatetimeLocalValue } from '@/lib/ui/datetime';
import { LoadItemFields } from './LoadItemFields';
import { EMPTY_NEW_LOAD_ITEM, NewLoadItemsEditor, newLoadItemsRevenue, type NewLoadItem } from './NewLoadItemsEditor';
import { CHECKLIST_FIELDS } from '@/lib/loads/checklist';
import { findProductChanges, ProductSyncPrompt, type ProductSyncProposal } from '@/components/products/ProductSyncPrompt';

type LoadRow = {
  id: string;
  codigo_interno?: string | null;
  tipo?: string | null;
  status?: string | null;
  prioridade?: string | null;
  data_agendada?: string | null;
  data_prevista_recebimento?: string | null;
  data_real_recebimento?: string | null;
  responsavel_operacional_id?: string | null;
  cd_origem_id?: string | null;
  tipo_coleta_id?: string | null;
  transportador_id?: string | null;
  numero_carga_marketplace?: string | null;
  codigo_agendamento?: string | null;
  observacoes?: string | null;
  cmv_total?: number | null;
  faturamento_estimado?: number | null;
  custo_frete?: number | null;
  outros_custos?: number | null;
  [key: string]: string | number | boolean | null | undefined;
};

type LoadItemRow = {
  id: string;
  sku?: string | null;
  nome_produto?: string | null;
  quantidade?: number | null;
  fornecedor_origem_id?: string | null;
  cmv_unitario?: number | null;
  cmv_total?: number | null;
  peso?: number | null;
  altura?: number | null;
  largura?: number | null;
  profundidade?: number | null;
  cubagem?: number | string | null;
  data_prevista_recebimento?: string | null;
  data_real_recebimento?: string | null;
  status_item?: string | null;
  observacao?: string | null;
};

type ChecklistRow = Record<string, boolean | null | undefined> & { id: string; nf_emitida?: boolean | null };
type Option = { id: string; nome: string; tipo?: string | null };
type ItemDraft = {
  sku: string;
  nome_produto: string;
  quantidade: string;
  fornecedor_origem_id?: string;
  cmv_unitario?: string;
  peso?: string;
  altura?: string;
  largura?: string;
  profundidade?: string;
  data_prevista_recebimento?: string;
  data_real_recebimento?: string;
  status_item?: string;
  observacao?: string;
};

const PAGE_SIZE = 50;

const brl = (v: number | string | null | undefined) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const shortDate = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-';
const EMPTY_ITEM: ItemDraft = { sku: '', nome_produto: '', quantidade: '1', cmv_unitario: '0' };

export function CargasManager({ profile }: { profile: UserProfile }) {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const [loads, setLoads] = useState<LoadRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selected, setSelected] = useState<LoadRow | null>(null);
  const [items, setItems] = useState<LoadItemRow[]>([]);
  const [checklist, setChecklist] = useState<ChecklistRow | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Record<string, string>>(() => ({
    tipo: 'LOJA_FISICA',
    status: 'Rascunho',
    prioridade: 'Média',
    custo_frete: '0',
    outros_custos: '0',
    data_agendada: searchParams.get('data_agendada') ?? '',
  }));
  const [newItems, setNewItems] = useState<NewLoadItem[]>([EMPTY_NEW_LOAD_ITEM]);
  // Enquanto o usuário não digitar o faturamento, ele acompanha a soma do
  // preço de venda × quantidade dos itens escolhidos.
  const [faturamentoManual, setFaturamentoManual] = useState(false);
  const [detailNewItem, setDetailNewItem] = useState<ItemDraft>(EMPTY_ITEM);
  const [editingItem, setEditingItem] = useState<ItemDraft & { id: string } | null>(null);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);
  const toast = useToast();
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelMotivo, setCancelMotivo] = useState('');
  const [confirmFinalize, setConfirmFinalize] = useState(false);
  const [options, setOptions] = useState<{ companies: Option[]; channels: Option[]; stores: Option[]; destinations: Option[]; cds: Option[]; suppliers: Option[]; transports: Option[]; profiles: Option[] }>({ companies: [], channels: [], stores: [], destinations: [], cds: [], suppliers: [], transports: [], profiles: [] });
  const [page, setPage] = useState(0);
  const [totalLoads, setTotalLoads] = useState(0);
  const [productSync, setProductSync] = useState<ProductSyncProposal | null>(null);

  const canWrite = ['admin', 'gerente_estoque', 'gerente_ecommerce'].includes(profile.perfil);
  const canChecklist = ['admin', 'gerente_estoque', 'operador_carga'].includes(profile.perfil);
  const canSeeFinancial = ['admin', 'gerente_estoque', 'gerente_ecommerce', 'financeiro'].includes(profile.perfil);
  const canEditFinancialOnly = profile.perfil === 'financeiro';
  const canEditFinancial = canSeeFinancial && (canWrite || canEditFinancialOnly);
  const selectedCompanyId = typeof selected?.empresa_id === 'string' ? selected.empresa_id : null;
  const canManageProducts = profile.perfil === 'admin' || profile.perfil === 'gerente_estoque';

  // Depois de salvar um item: se o CMV ou o fornecedor digitados diferem do
  // cadastro do produto, pergunta se deve atualizar o produto.
  async function proposeProductUpdate(item: ItemDraft) {
    if (!canManageProducts) return;
    setProductSync(await findProductChanges(supabase, item, options.suppliers));
  }

  const itemTotals = useMemo(() => {
    let peso = 0;
    let cubagem = 0;
    for (const i of items) {
      const qty = Number(i.quantidade ?? 0);
      if (i.peso != null) peso += Number(i.peso) * qty;
      if (i.cubagem != null) cubagem += Number(i.cubagem) * qty;
    }
    return { peso, cubagem };
  }, [items]);

  const loadData = useCallback(async () => {
    setLoadingList(true);
    const { data } = await supabase.rpc('get_visible_loads_page', { p_page: page + 1, p_page_size: PAGE_SIZE });
    const rows = (data ?? []) as (LoadRow & { total_count?: number })[];
    setLoads(rows);
    setTotalLoads(Number(rows[0]?.total_count ?? 0));
    setLoadingList(false);
  }, [supabase, page]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    async function loadOptions() {
      const [companies, channels, stores, destinations, cds, suppliers, transports, profiles] = await Promise.all([
        supabase.from('companies').select('id,nome').eq('ativo', true).order('nome'),
        supabase.from('channels').select('id,nome,tipo').eq('ativo', true).order('nome'),
        supabase.from('stores').select('id,nome').eq('ativo', true).order('nome'),
        supabase.from('full_destinations').select('id,nome').eq('ativo', true).order('nome'),
        supabase.from('distribution_centers').select('id,nome').eq('ativo', true).order('nome'),
        supabase.from('suppliers').select('id,nome').eq('ativo', true).order('nome'),
        supabase.from('transport_types').select('id,nome,tipo').eq('ativo', true).order('nome'),
        supabase.from('users_profile').select('id,nome').eq('ativo', true).order('nome').limit(200),
      ]);
      setOptions({ companies: companies.data ?? [], channels: channels.data ?? [], stores: stores.data ?? [], destinations: destinations.data ?? [], cds: cds.data ?? [], suppliers: suppliers.data ?? [], transports: transports.data ?? [], profiles: profiles.data ?? [] });
    }
    loadOptions();
  }, [supabase]);

  const suggestedRevenue = newLoadItemsRevenue(newItems);
  const filledNewItems = newItems.filter((i) => i.sku.trim() || i.nome_produto.trim());
  const newItemsCount = filledNewItems.length;
  const newItemsUnits = filledNewItems.reduce((sum, i) => sum + Number(i.quantidade || 0), 0);
  const faturamentoEstimado = faturamentoManual ? (form.faturamento_estimado ?? '') : suggestedRevenue > 0 ? suggestedRevenue.toFixed(2) : '';

  async function createLoad() {
    if (!canWrite) return;
    const itemsToSave = newItems.filter((i) => i.sku.trim() || i.nome_produto.trim());
    if (itemsToSave.length === 0 || itemsToSave.some((i) => !i.sku.trim() || Number(i.quantidade || 0) <= 0)) {
      toast.error('Informe ao menos um item, cada um com SKU e quantidade maior que zero.');
      return;
    }
    if (profile.perfil === 'gerente_ecommerce' && form.tipo !== 'FULL_MARKETPLACE') {
      toast.error('Gerente e-commerce pode criar apenas cargas FULL.');
      return;
    }

    setCreating(true);
    let response: Response;
    let result: { error?: string };
    try {
      response = await fetch('/api/loads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          load: {
            tipo: form.tipo,
            status: form.status,
            prioridade: form.prioridade,
            empresa_id: form.empresa_id || null,
            canal_id: form.canal_id || null,
            marketplace_id: form.marketplace_id || null,
            destino_full_id: form.destino_full_id || null,
            loja_destino_id: form.loja_destino_id || null,
            cd_origem_id: form.cd_origem_id || null,
            responsavel_operacional_id: form.responsavel_operacional_id || null,
            data_agendada: form.data_agendada || null,
            custo_frete: form.custo_frete || 0,
            outros_custos: form.outros_custos || 0,
            faturamento_estimado: faturamentoEstimado || null,
            numero_carga_marketplace: form.numero_carga_marketplace || null,
            codigo_agendamento: form.codigo_agendamento || null,
            tipo_coleta_id: form.tipo_coleta_id || null,
            transportador_id: form.transportador_id || null,
            observacoes: form.observacoes || null,
          },
          items: itemsToSave.map((i) => ({ sku: i.sku.trim(), nome_produto: i.nome_produto.trim(), quantidade: i.quantidade })),
        }),
      });
      result = await response.json();
    } catch {
      setCreating(false);
      return toast.error('Erro ao criar carga. Tente de novo.');
    }
    setCreating(false);
    if (!response.ok) return toast.error(translateError(result.error, 'Erro ao criar carga.'));

    setNewItems([EMPTY_NEW_LOAD_ITEM]);
    setFaturamentoManual(false);
    setForm((prev) => ({ ...prev, faturamento_estimado: '' }));
    setShowCreate(false);
    toast.success('Carga criada. Abra o detalhe para completar os dados dos itens.');
    await loadData();
  }

  async function openLoad(load: LoadRow) {
    setSelected(load);
    setShowCancelForm(false);
    setConfirmFinalize(false);
    setEditingItem(null);
    setRemovingItemId(null);
    const [it, chk] = await Promise.all([
      supabase.rpc('get_visible_load_items', { p_load_id: load.id }),
      supabase.from('load_checklists').select('*').eq('load_id', load.id).single(),
    ]);
    setItems((it.data ?? []) as LoadItemRow[]);
    setChecklist(chk.data as ChecklistRow | null);
  }

  // /cargas?abrir=<id>: abre direto o painel de edição da carga (vindo da tela de detalhe).
  const openParam = searchParams.get('abrir');
  useEffect(() => {
    if (!openParam) return;
    let cancelled = false;
    supabase.rpc('get_visible_loads').then(({ data }) => {
      const found = ((data ?? []) as LoadRow[]).find((l) => l.id === openParam);
      if (!cancelled && found) openLoad(found);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openParam]);

  async function addItem() {
    if (!selected || !canWrite) return;
    const { data: productRows } = await supabase.rpc('get_visible_product_by_sku', { p_sku: detailNewItem.sku, p_company_id: selectedCompanyId });
    const product = Array.isArray(productRows) ? productRows[0] : null;
    const payload = {
      load_id: selected.id,
      product_id: product?.id ?? null,
      sku: detailNewItem.sku,
      nome_produto: detailNewItem.nome_produto || product?.nome,
      quantidade: detailNewItem.quantidade,
      fornecedor_origem_id: detailNewItem.fornecedor_origem_id || product?.fornecedor_id || null,
      cmv_unitario: detailNewItem.cmv_unitario || product?.cmv || 0,
      altura: detailNewItem.altura || product?.altura || null,
      largura: detailNewItem.largura || product?.largura || null,
      profundidade: detailNewItem.profundidade || product?.profundidade || null,
      peso: detailNewItem.peso || product?.peso || null,
      data_prevista_recebimento: detailNewItem.data_prevista_recebimento || null,
      data_real_recebimento: detailNewItem.data_real_recebimento || null,
      status_item: detailNewItem.status_item || null,
      observacao: detailNewItem.observacao || null,
    };
    const res = await fetch(`/api/loads/${selected.id}/items`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) { const j = await res.json(); return toast.error(translateError(j.error, 'Erro ao adicionar item.')); }
    const addedItem = detailNewItem;
    setDetailNewItem(EMPTY_ITEM);
    await openLoad(selected);
    await loadData();
    await proposeProductUpdate(addedItem);
  }

  function editItem(item: LoadItemRow) {
    setEditingItem({
      id: item.id,
      sku: item.sku ?? '',
      nome_produto: item.nome_produto ?? '',
      quantidade: String(item.quantidade ?? 0),
      fornecedor_origem_id: item.fornecedor_origem_id ?? '',
      cmv_unitario: String(item.cmv_unitario ?? 0),
      peso: item.peso != null ? String(item.peso) : '',
      altura: item.altura != null ? String(item.altura) : '',
      largura: item.largura != null ? String(item.largura) : '',
      profundidade: item.profundidade != null ? String(item.profundidade) : '',
      data_prevista_recebimento: item.data_prevista_recebimento ?? '',
      data_real_recebimento: item.data_real_recebimento ?? '',
      status_item: item.status_item ?? '',
      observacao: item.observacao ?? '',
    });
  }

  async function saveEditingItem() {
    if (!selected || !canWrite || !editingItem) return;
    const res = await fetch(`/api/loads/${selected.id}/items`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingItem),
    });
    if (!res.ok) { const j = await res.json(); toast.error(translateError(j.error, 'Erro ao editar item.')); return; }
    const editedItem = editingItem;
    setEditingItem(null);
    await openLoad(selected);
    await loadData();
    await proposeProductUpdate(editedItem);
  }

  async function removeItem(item: LoadItemRow) {
    if (!selected || !canWrite) return;
    if (removingItemId !== item.id) {
      setRemovingItemId(item.id);
      return;
    }
    const res = await fetch(`/api/loads/${selected.id}/items?itemId=${item.id}`, { method: 'DELETE' });
    setRemovingItemId(null);
    if (!res.ok) { const j = await res.json(); toast.error(translateError(j.error, 'Erro ao remover item.')); return; }
    await openLoad(selected);
    await loadData();
  }

  async function patchSelectedLoad() {
    if (!selected || !canWrite) return;
    const res = await fetch(`/api/loads/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: selected.status,
        prioridade: selected.prioridade,
        responsavel_operacional_id: selected.responsavel_operacional_id ?? null,
        cd_origem_id: selected.cd_origem_id ?? null,
        tipo_coleta_id: selected.tipo_coleta_id ?? null,
        transportador_id: selected.transportador_id ?? null,
        data_agendada: selected.data_agendada ?? null,
        data_real_recebimento: selected.data_real_recebimento ?? null,
        numero_carga_marketplace: selected.numero_carga_marketplace ?? null,
        codigo_agendamento: selected.codigo_agendamento ?? null,
        observacoes: selected.observacoes ?? null,
      }),
    });
    if (!res.ok) { const j = await res.json(); toast.error(translateError(j.error, 'Erro ao atualizar carga.')); return; }
    toast.success('Dados da carga atualizados.');
    await loadData();
  }

  async function patchSelectedFinancial() {
    if (!selected || !canEditFinancial) return;
    const route = canWrite ? `/api/loads/${selected.id}` : `/api/loads/${selected.id}/financial`;
    const res = await fetch(route, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        custo_frete: selected.custo_frete ?? 0,
        outros_custos: selected.outros_custos ?? 0,
        faturamento_estimado: selected.faturamento_estimado ?? null,
      }),
    });
    if (!res.ok) { const j = await res.json(); toast.error(translateError(j.error, 'Erro ao atualizar financeiro.')); return; }
    toast.success('Financeiro atualizado.');
    await openLoad(selected);
    await loadData();
  }

  async function toggleChecklist(field: string, value: boolean) {
    if (!selected || !checklist || !canChecklist) return;
    const res = await fetch(`/api/loads/${selected.id}/checklist`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ field, value }) });
    if (!res.ok) { const j = await res.json(); toast.error(translateError(j.error, 'Não foi possível atualizar o checklist.')); return; }
    await openLoad(selected);
  }

  async function confirmCancel() {
    if (!selected || !canWrite || !cancelMotivo.trim()) return;
    const res = await fetch(`/api/loads/${selected.id}/cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ motivo: cancelMotivo }) });
    if (!res.ok) { const j = await res.json(); toast.error(translateError(j.error, 'Erro ao cancelar a carga.')); return; }
    setShowCancelForm(false);
    setCancelMotivo('');
    toast.success('Carga cancelada.');
    await openLoad({ ...selected, status: 'Cancelada' });
    await loadData();
  }

  async function finalizeLoad() {
    if (!selected || !canWrite) return;
    if (checklist && !checklist.nf_emitida && !confirmFinalize) {
      setConfirmFinalize(true);
      return;
    }
    const res = await fetch(`/api/loads/${selected.id}/finalize`, { method: 'POST' });
    const j = await res.json();
    if (!res.ok) { toast.error(translateError(j.error, 'Erro ao finalizar a carga.')); return; }
    setConfirmFinalize(false);
    if (j.warning) toast.warning('Carga finalizada sem NF emitida.');
    else toast.success('Carga finalizada com sucesso.');
    await openLoad({ ...selected, status: 'Finalizada' });
    await loadData();
  }

  const totalLoadPages = Math.max(1, Math.ceil(totalLoads / PAGE_SIZE));

  const totals = useMemo(() => {
    const cmv = items.reduce((sum, i) => sum + Number(i.cmv_total || 0), 0);
    const fat = Number(selected?.faturamento_estimado || 0);
    const frete = Number(selected?.custo_frete || 0);
    const outros = Number(selected?.outros_custos || 0);
    const margemValor = fat - cmv - frete - outros;
    const margemPct = fat > 0 ? margemValor / fat : null;
    return { cmv, margemValor, margemPct };
  }, [items, selected]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canWrite && (
          <Button variant="primary" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            Nova carga
          </Button>
        )}
      </div>

      <Card>
        <CardBody className="p-0">
          {loadingList ? (
            <div className="p-4"><SkeletonRows rows={6} /></div>
          ) : loads.length === 0 ? (
            <EmptyState title="Nenhuma carga ainda" description="Crie a primeira carga pelo botão acima ou transforme uma solicitação aprovada." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-left text-xs font-medium text-zinc-500">
                    <th className="px-3 py-2.5">Código</th>
                    <th className="px-3 py-2.5">Tipo / destino</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5">Prioridade</th>
                    <th className="px-3 py-2.5">Agendada</th>
                    <th className="px-3 py-2.5">Previsão receb.</th>
                    {canSeeFinancial && <th className="px-3 py-2.5 text-right">CMV total</th>}
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {loads.map((l) => (
                    <tr key={l.id} className="cursor-pointer border-b border-zinc-50 last:border-0 hover:bg-zinc-50" onClick={() => openLoad(l)}>
                      <td className="whitespace-nowrap px-3 py-2 font-medium text-zinc-800">{l.codigo_interno}</td>
                      <td className="px-3 py-2 text-zinc-600">
                        {l.tipo === 'FULL_MARKETPLACE' ? 'Full' : 'Loja'}
                        {(l.loja_nome || l.canal_nome) && <span className="text-zinc-400"> · {String(l.loja_nome || l.canal_nome)}</span>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2"><Badge tone={loadStatusTone(l.status)} dot>{l.status}</Badge></td>
                      <td className="px-3 py-2 text-zinc-600">{l.prioridade ?? '-'}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-zinc-600">{shortDate(l.data_agendada)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-zinc-600">{shortDate(l.data_prevista_recebimento)}</td>
                      {canSeeFinancial && <td className="whitespace-nowrap px-3 py-2 text-right text-zinc-600">{brl(l.cmv_total)}</td>}
                      <td className="px-3 py-2 text-right">
                        <button className="font-medium text-brand-600 hover:text-brand-700" onClick={(e) => { e.stopPropagation(); openLoad(l); }}>Detalhe</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-3 text-sm">
            <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Anterior</Button>
            <span className="text-zinc-500">Página {page + 1} de {totalLoadPages} ({totalLoads} cargas)</span>
            <Button variant="secondary" size="sm" disabled={page + 1 >= totalLoadPages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
          </div>
        </CardBody>
      </Card>

      <Dialog
        open={showCreate}
        onClose={() => !creating && setShowCreate(false)}
        title="Nova carga"
        description="Preencha o destino e os itens. Os demais dados podem ser completados depois, no detalhe da carga."
        size="xl"
        footer={
          canWrite && (
            <div className="flex w-full flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-zinc-500">
                {newItemsCount} {newItemsCount === 1 ? 'item' : 'itens'} · {newItemsUnits.toLocaleString('pt-BR')} un.
                {canEditFinancial && Number(faturamentoEstimado) > 0 && <> · faturamento {Number(faturamentoEstimado).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</>}
              </span>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setShowCreate(false)} disabled={creating}>Cancelar</Button>
                <Button variant="primary" onClick={createLoad} disabled={creating}>{creating ? 'Criando...' : 'Criar carga'}</Button>
              </div>
            </div>
          )
        }
      >
        <div className="space-y-6">
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">1. Destino</h3>
            <div className="inline-flex overflow-hidden rounded-lg border border-zinc-300 text-sm">
              {([['LOJA_FISICA', 'Loja física'], ['FULL_MARKETPLACE', 'Full marketplace']] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  disabled={profile.perfil === 'gerente_ecommerce' && value === 'LOJA_FISICA'}
                  onClick={() => setForm({ ...form, tipo: value })}
                  className={cn(
                    'px-4 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-40',
                    form.tipo === value ? 'bg-brand-600 text-white' : 'bg-white text-zinc-600 hover:bg-zinc-50',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <FieldGroup label="Empresa">
                <Select value={form.empresa_id ?? ''} onChange={(e) => setForm({ ...form, empresa_id: e.target.value })}>
                  <option value="">Selecionar</option>
                  {options.companies.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                </Select>
              </FieldGroup>
              {form.tipo === 'LOJA_FISICA' ? (
                <FieldGroup label="Loja destino">
                  <Select value={form.loja_destino_id ?? ''} onChange={(e) => setForm({ ...form, loja_destino_id: e.target.value })}>
                    <option value="">Selecionar</option>
                    {options.stores.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                  </Select>
                </FieldGroup>
              ) : (
                <>
                  <FieldGroup label="Marketplace">
                    <Select value={form.marketplace_id ?? ''} onChange={(e) => setForm({ ...form, marketplace_id: e.target.value })}>
                      <option value="">Selecionar</option>
                      {options.channels.filter((o) => o.tipo === 'Marketplace Full').map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                    </Select>
                  </FieldGroup>
                  <FieldGroup label="Destino Full">
                    <Select value={form.destino_full_id ?? ''} onChange={(e) => setForm({ ...form, destino_full_id: e.target.value })}>
                      <option value="">Selecionar</option>
                      {options.destinations.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                    </Select>
                  </FieldGroup>
                </>
              )}
              <FieldGroup label="Canal">
                <Select value={form.canal_id ?? ''} onChange={(e) => setForm({ ...form, canal_id: e.target.value })}>
                  <option value="">Selecionar</option>
                  {options.channels.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                </Select>
              </FieldGroup>
            </div>
          </section>

          <section className="space-y-2 border-t border-zinc-100 pt-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">2. Itens</h3>
            <p className="text-xs text-zinc-500">
              Informe SKU, nome e quantidade{form.empresa_id ? ' (a busca mostra os produtos da empresa escolhida)' : ''}. CMV, fornecedor, peso e medidas vêm do cadastro do produto.
            </p>
            <NewLoadItemsEditor items={newItems} onChange={setNewItems} companyId={form.empresa_id} />
          </section>

          <section className="space-y-3 border-t border-zinc-100 pt-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">3. Agendamento e operação <span className="font-normal normal-case text-zinc-400">(opcional)</span></h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <FieldGroup label="Data agendada">
                <Input type="datetime-local" value={toDatetimeLocalValue(form.data_agendada)} onChange={(e) => setForm({ ...form, data_agendada: fromDatetimeLocalValue(e.target.value) ?? '' })} />
              </FieldGroup>
              <FieldGroup label="Prioridade">
                <Select value={form.prioridade} onChange={(e) => setForm({ ...form, prioridade: e.target.value })}>
                  <option value="Baixa">Baixa</option>
                  <option value="Média">Média</option>
                  <option value="Alta">Alta</option>
                  <option value="Urgente">Urgente</option>
                </Select>
              </FieldGroup>
              <FieldGroup label="CD de origem">
                <Select value={form.cd_origem_id ?? ''} onChange={(e) => setForm({ ...form, cd_origem_id: e.target.value })}>
                  <option value="">Selecionar</option>
                  {options.cds.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                </Select>
              </FieldGroup>
              <FieldGroup label="Responsável operacional">
                <Select value={form.responsavel_operacional_id ?? ''} onChange={(e) => setForm({ ...form, responsavel_operacional_id: e.target.value })}>
                  <option value="">Selecionar</option>
                  {options.profiles.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                </Select>
              </FieldGroup>
              <FieldGroup label="Tipo de coleta">
                <Select value={form.tipo_coleta_id ?? ''} onChange={(e) => setForm({ ...form, tipo_coleta_id: e.target.value })}>
                  <option value="">Selecionar</option>
                  {options.transports.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                </Select>
              </FieldGroup>
              <FieldGroup label="Transportador">
                <Select value={form.transportador_id ?? ''} onChange={(e) => setForm({ ...form, transportador_id: e.target.value })}>
                  <option value="">Selecionar</option>
                  {options.transports.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                </Select>
              </FieldGroup>
              {form.tipo === 'FULL_MARKETPLACE' && (
                <>
                  <FieldGroup label="Nº carga marketplace">
                    <Input value={form.numero_carga_marketplace ?? ''} onChange={(e) => setForm({ ...form, numero_carga_marketplace: e.target.value })} />
                  </FieldGroup>
                  <FieldGroup label="Código de agendamento">
                    <Input value={form.codigo_agendamento ?? ''} onChange={(e) => setForm({ ...form, codigo_agendamento: e.target.value })} />
                  </FieldGroup>
                </>
              )}
            </div>
          </section>

          {canEditFinancial && (
            <section className="space-y-3 border-t border-zinc-100 pt-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">4. Financeiro</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <FieldGroup label="Faturamento estimado">
                  <Input
                    type="number"
                    value={faturamentoEstimado}
                    onChange={(e) => {
                      setFaturamentoManual(true);
                      setForm({ ...form, faturamento_estimado: e.target.value });
                    }}
                  />
                  {!faturamentoManual && suggestedRevenue > 0 && (
                    <span className="text-xs text-zinc-500">Soma do preço de venda × quantidade dos itens</span>
                  )}
                  {faturamentoManual && suggestedRevenue > 0 && (
                    <button type="button" className="self-start text-xs font-medium text-brand-600 hover:underline" onClick={() => setFaturamentoManual(false)}>
                      Usar soma dos itens (R$ {suggestedRevenue.toFixed(2)})
                    </button>
                  )}
                </FieldGroup>
                <FieldGroup label="Custo de frete">
                  <Input type="number" value={form.custo_frete} onChange={(e) => setForm({ ...form, custo_frete: e.target.value })} />
                </FieldGroup>
                <FieldGroup label="Outros custos">
                  <Input type="number" value={form.outros_custos} onChange={(e) => setForm({ ...form, outros_custos: e.target.value })} />
                </FieldGroup>
              </div>
            </section>
          )}

          <section className="border-t border-zinc-100 pt-5">
            <FieldGroup label="Observações">
              <Textarea value={form.observacoes ?? ''} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
            </FieldGroup>
          </section>
        </div>
      </Dialog>

      <Dialog
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.codigo_interno ?? ''}
        description={selected ? <Badge tone={loadStatusTone(selected.status)} dot>{selected.status}</Badge> : undefined}
        size="xl"
      >
        {selected && (
          <div className="space-y-5">
            {selected.id && (
              <Link href={`/cargas/${selected.id}`} className="inline-flex text-sm font-medium text-brand-600 hover:text-brand-700">
                Abrir página da carga →
              </Link>
            )}

            {canWrite && (
              <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Dados da carga</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <FieldGroup label="Status">
                  <Select value={selected.status ?? ''} onChange={(e) => setSelected({ ...selected, status: e.target.value })}>
                    {LOAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </Select>
                </FieldGroup>
                <FieldGroup label="Prioridade">
                  <Select value={selected.prioridade ?? ''} onChange={(e) => setSelected({ ...selected, prioridade: e.target.value })}>
                    <option value="Baixa">Baixa</option>
                    <option value="Média">Média</option>
                    <option value="Alta">Alta</option>
                    <option value="Urgente">Urgente</option>
                  </Select>
                </FieldGroup>
                <FieldGroup label="Responsável">
                  <Select value={String(selected.responsavel_operacional_id ?? '')} onChange={(e) => setSelected({ ...selected, responsavel_operacional_id: e.target.value || null })}>
                    <option value="">Selecionar</option>
                    {options.profiles.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                  </Select>
                </FieldGroup>
                <FieldGroup label="CD de origem">
                  <Select value={String(selected.cd_origem_id ?? '')} onChange={(e) => setSelected({ ...selected, cd_origem_id: e.target.value || null })}>
                    <option value="">Selecionar</option>
                    {options.cds.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                  </Select>
                </FieldGroup>
                <FieldGroup label="Tipo de coleta">
                  <Select value={String(selected.tipo_coleta_id ?? '')} onChange={(e) => setSelected({ ...selected, tipo_coleta_id: e.target.value || null })}>
                    <option value="">Selecionar</option>
                    {options.transports.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                  </Select>
                </FieldGroup>
                <FieldGroup label="Transportador">
                  <Select value={String(selected.transportador_id ?? '')} onChange={(e) => setSelected({ ...selected, transportador_id: e.target.value || null })}>
                    <option value="">Selecionar</option>
                    {options.transports.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                  </Select>
                </FieldGroup>
                <FieldGroup label="Data agendada">
                  <Input type="datetime-local" value={toDatetimeLocalValue(selected.data_agendada)} onChange={(e) => setSelected({ ...selected, data_agendada: fromDatetimeLocalValue(e.target.value) })} />
                </FieldGroup>
                <FieldGroup label="Previsão de recebimento (pelos itens)">
                  <p className="flex h-10 items-center text-sm text-zinc-700">
                    {selected.data_prevista_recebimento ? new Date(selected.data_prevista_recebimento).toLocaleString('pt-BR') : 'Defina nas datas dos itens'}
                  </p>
                </FieldGroup>
                <FieldGroup label="Recebimento real">
                  <Input type="datetime-local" value={toDatetimeLocalValue(selected.data_real_recebimento)} onChange={(e) => setSelected({ ...selected, data_real_recebimento: fromDatetimeLocalValue(e.target.value) })} />
                </FieldGroup>
                <FieldGroup label="Nº carga marketplace">
                  <Input value={String(selected.numero_carga_marketplace ?? '')} onChange={(e) => setSelected({ ...selected, numero_carga_marketplace: e.target.value || null })} />
                </FieldGroup>
                <FieldGroup label="Código de agendamento">
                  <Input value={String(selected.codigo_agendamento ?? '')} onChange={(e) => setSelected({ ...selected, codigo_agendamento: e.target.value || null })} />
                </FieldGroup>
                <div className="flex items-end">
                  <Button variant="secondary" onClick={patchSelectedLoad}>Salvar dados da carga</Button>
                </div>
              </div>
              <p className="mt-2 text-xs text-zinc-400">Agendar antes do recebimento e finalizar sem NF é permitido, mas gera alerta.</p>
              </div>
            )}

            {canEditFinancial && (
              <div className="rounded-lg bg-zinc-50 p-3">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Financeiro</h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <FieldGroup label="Faturamento estimado">
                    <Input type="number" value={Number(selected.faturamento_estimado ?? 0)} onChange={(e) => setSelected({ ...selected, faturamento_estimado: Number(e.target.value) })} />
                  </FieldGroup>
                  <FieldGroup label="Custo de frete">
                    <Input type="number" value={Number(selected.custo_frete ?? 0)} onChange={(e) => setSelected({ ...selected, custo_frete: Number(e.target.value) })} />
                  </FieldGroup>
                  <FieldGroup label="Outros custos">
                    <Input type="number" value={Number(selected.outros_custos ?? 0)} onChange={(e) => setSelected({ ...selected, outros_custos: Number(e.target.value) })} />
                  </FieldGroup>
                </div>
                <Button variant="secondary" className="mt-3" onClick={patchSelectedFinancial}>Salvar financeiro</Button>
              </div>
            )}

            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Itens da carga</h3>
                <div className="flex flex-wrap gap-4 text-xs text-zinc-500">
                  <span>Peso total: <strong className="text-zinc-700">{itemTotals.peso.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg</strong></span>
                  <span>Cubagem total: <strong className="text-zinc-700">{itemTotals.cubagem.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} m³</strong></span>
                </div>
              </div>
              <div className="overflow-x-auto rounded-lg border border-zinc-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 text-left text-xs font-medium text-zinc-500">
                      <th className="px-3 py-2">SKU</th>
                      <th className="px-3 py-2">Nome</th>
                      <th className="px-3 py-2 text-right">Qtd</th>
                      {canSeeFinancial && <th className="px-3 py-2 text-right">CMV unit.</th>}
                      {canSeeFinancial && <th className="px-3 py-2 text-right">CMV total</th>}
                      <th className="px-3 py-2 text-right">Cubagem</th>
                      <th className="px-3 py-2">Previsão</th>
                      {canWrite && <th className="px-3 py-2" />}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((i) => (
                      <tr key={i.id} className="border-b border-zinc-50 last:border-0">
                        <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-zinc-600">{i.sku}</td>
                        <td className="min-w-[12rem] px-3 py-2">{i.nome_produto}</td>
                        <td className="px-3 py-2 text-right">{i.quantidade}</td>
                        {canSeeFinancial && <td className="whitespace-nowrap px-3 py-2 text-right">{brl(i.cmv_unitario)}</td>}
                        {canSeeFinancial && <td className="whitespace-nowrap px-3 py-2 text-right">{brl(i.cmv_total)}</td>}
                        <td className="whitespace-nowrap px-3 py-2 text-right">{i.cubagem != null ? `${Number(i.cubagem).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} m³` : '-'}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-zinc-600">{i.data_prevista_recebimento ? new Date(i.data_prevista_recebimento).toLocaleDateString('pt-BR') : '-'}</td>
                        {canWrite && (
                          <td className="whitespace-nowrap px-3 py-2 text-right">
                            {removingItemId === i.id ? (
                              <span className="space-x-2">
                                <button className="font-medium text-rose-700 hover:text-rose-800" onClick={() => removeItem(i)}>Remover?</button>
                                <button className="font-medium text-zinc-500 hover:text-zinc-700" onClick={() => setRemovingItemId(null)}>Não</button>
                              </span>
                            ) : (
                              <span className="inline-flex gap-1">
                                <button aria-label={`Editar ${i.sku}`} title="Editar" className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700" onClick={() => editItem(i)}>
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button aria-label={`Remover ${i.sku}`} title="Remover" className="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => removeItem(i)}>
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                    {items.length === 0 && (
                      <tr><td colSpan={5 + (canSeeFinancial ? 2 : 0) + (canWrite ? 1 : 0)} className="px-3 py-4 text-center text-zinc-400">Nenhum item ainda.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {canWrite && (
                <div className="mt-3 rounded-lg border border-dashed border-zinc-200 p-3">
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Adicionar item</h4>
                  <LoadItemFields value={detailNewItem} onChange={(field, value) => setDetailNewItem((prev) => ({ ...prev, [field]: value }))} suppliers={options.suppliers} showFinancial={canSeeFinancial} companyId={selectedCompanyId} />
                  <Button variant="secondary" className="mt-2" onClick={addItem}>Adicionar item</Button>
                </div>
              )}

              {editingItem && canWrite && (
                <div className="mt-3 rounded-lg bg-zinc-50 p-3">
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Editar item</h4>
                  <LoadItemFields value={editingItem} onChange={(field, value) => setEditingItem((prev) => (prev ? { ...prev, [field]: value } : prev))} suppliers={options.suppliers} showFinancial={canSeeFinancial} companyId={selectedCompanyId} />
                  <div className="mt-2 flex gap-2">
                    <Button variant="primary" onClick={saveEditingItem}>Salvar item</Button>
                    <Button variant="ghost" onClick={() => setEditingItem(null)}>Cancelar</Button>
                  </div>
                </div>
              )}
            </div>

            {canSeeFinancial && (
              <div className="grid grid-cols-3 gap-3 rounded-lg bg-zinc-50 p-3 text-sm">
                <div><div className="text-xs text-zinc-500">CMV total</div><div className="font-semibold">{brl(totals.cmv)}</div></div>
                <div><div className="text-xs text-zinc-500">Margem (valor)</div><div className={`font-semibold ${totals.margemValor >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{brl(totals.margemValor)}</div></div>
                <div><div className="text-xs text-zinc-500">Margem (%)</div><div className="font-semibold">{totals.margemPct === null ? 'pendente' : `${(totals.margemPct * 100).toFixed(2)}%`}</div></div>
              </div>
            )}

            {checklist && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Checklist operacional</h3>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                  {CHECKLIST_FIELDS.map((f) => (
                    <label key={f.key} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${checklist[f.key] ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-zinc-200 text-zinc-600'}`}>
                      <input type="checkbox" checked={!!checklist[f.key]} onChange={(e) => toggleChecklist(f.key, e.target.checked)} disabled={!canChecklist} />
                      {f.label}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {canWrite && (
              <div className="flex flex-wrap items-start gap-3 border-t border-zinc-100 pt-4">
                {!showCancelForm ? (
                  <Button variant="danger" onClick={() => setShowCancelForm(true)}>Cancelar carga</Button>
                ) : (
                  <div className="w-full space-y-2 rounded-lg bg-rose-50 p-3">
                    <FieldGroup label="Motivo do cancelamento">
                      <Textarea value={cancelMotivo} onChange={(e) => setCancelMotivo(e.target.value)} />
                    </FieldGroup>
                    <div className="flex gap-2">
                      <Button variant="danger" disabled={!cancelMotivo.trim()} onClick={confirmCancel}>Confirmar cancelamento</Button>
                      <Button variant="ghost" onClick={() => setShowCancelForm(false)}>Voltar</Button>
                    </div>
                  </div>
                )}

                {!confirmFinalize ? (
                  <Button variant="primary" onClick={finalizeLoad}>Finalizar carga</Button>
                ) : (
                  <div className="w-full space-y-2 rounded-lg bg-amber-50 p-3">
                    <p className="flex items-center gap-1 text-sm text-amber-800"><AlertTriangle className="h-4 w-4" />NF não emitida. Finalizar mesmo assim?</p>
                    <div className="flex gap-2">
                      <Button variant="primary" onClick={finalizeLoad}>Confirmar finalização</Button>
                      <Button variant="ghost" onClick={() => setConfirmFinalize(false)}>Voltar</Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Dialog>
      <ProductSyncPrompt proposal={productSync} onClose={() => setProductSync(null)} supabase={supabase} />
    </div>
  );
}
