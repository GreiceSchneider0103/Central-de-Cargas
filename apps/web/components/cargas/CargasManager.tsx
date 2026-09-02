'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus, AlertTriangle } from 'lucide-react';
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
import { toDatetimeLocalValue, fromDatetimeLocalValue } from '@/lib/ui/datetime';
import { LoadItemFields } from './LoadItemFields';
import { CHECKLIST_FIELDS } from '@/lib/loads/checklist';

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
  const [form, setForm] = useState<Record<string, string>>(() => ({
    tipo: 'LOJA_FISICA',
    status: 'Rascunho',
    prioridade: 'Média',
    custo_frete: '0',
    outros_custos: '0',
    data_agendada: searchParams.get('data_agendada') ?? '',
  }));
  const [newItem, setNewItem] = useState<ItemDraft>(EMPTY_ITEM);
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

  const canWrite = ['admin', 'gerente_estoque', 'gerente_ecommerce'].includes(profile.perfil);
  const canChecklist = ['admin', 'gerente_estoque', 'operador_carga'].includes(profile.perfil);
  const canSeeFinancial = ['admin', 'gerente_estoque', 'gerente_ecommerce', 'financeiro'].includes(profile.perfil);
  const canEditFinancialOnly = profile.perfil === 'financeiro';
  const canEditFinancial = canSeeFinancial && (canWrite || canEditFinancialOnly);

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

  async function createLoad() {
    if (!canWrite) return;
    if (!newItem.sku || !newItem.nome_produto || Number(newItem.quantidade || 0) <= 0) {
      toast.error('Informe ao menos um item com SKU, nome e quantidade maior que zero.');
      return;
    }
    if (profile.perfil === 'gerente_ecommerce' && form.tipo !== 'FULL_MARKETPLACE') {
      toast.error('Gerente e-commerce pode criar apenas cargas FULL.');
      return;
    }

    const response = await fetch('/api/loads', {
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
          data_prevista_recebimento: form.data_prevista_recebimento || null,
          data_real_recebimento: form.data_real_recebimento || null,
          custo_frete: form.custo_frete || 0,
          outros_custos: form.outros_custos || 0,
          faturamento_estimado: form.faturamento_estimado || null,
          numero_carga_marketplace: form.numero_carga_marketplace || null,
          codigo_agendamento: form.codigo_agendamento || null,
          tipo_coleta_id: form.tipo_coleta_id || null,
          transportador_id: form.transportador_id || null,
          observacoes: form.observacoes || null,
        },
        items: [newItem],
      }),
    });

    const result = await response.json();
    if (!response.ok) return toast.error(translateError(result.error, 'Erro ao criar carga.'));

    setNewItem(EMPTY_ITEM);
    setShowCreate(false);
    toast.success('Carga criada com sucesso.');
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

  async function addItem() {
    if (!selected || !canWrite) return;
    const { data: productRows } = await supabase.rpc('get_visible_product_by_sku', { p_sku: detailNewItem.sku });
    const product = Array.isArray(productRows) ? productRows[0] : null;
    const payload = {
      load_id: selected.id,
      product_id: product?.id ?? null,
      sku: detailNewItem.sku,
      nome_produto: detailNewItem.nome_produto || product?.nome,
      quantidade: detailNewItem.quantidade,
      fornecedor_origem_id: detailNewItem.fornecedor_origem_id || null,
      cmv_unitario: detailNewItem.cmv_unitario || product?.cmv || 0,
      altura: detailNewItem.altura || null,
      largura: detailNewItem.largura || null,
      profundidade: detailNewItem.profundidade || null,
      peso: detailNewItem.peso || null,
      data_prevista_recebimento: detailNewItem.data_prevista_recebimento || null,
      data_real_recebimento: detailNewItem.data_real_recebimento || null,
      status_item: detailNewItem.status_item || null,
      observacao: detailNewItem.observacao || null,
    };
    const res = await fetch(`/api/loads/${selected.id}/items`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) { const j = await res.json(); return toast.error(translateError(j.error, 'Erro ao adicionar item.')); }
    setDetailNewItem(EMPTY_ITEM);
    await openLoad(selected);
    await loadData();
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
    setEditingItem(null);
    await openLoad(selected);
    await loadData();
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
        data_prevista_recebimento: selected.data_prevista_recebimento ?? null,
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
                    <th className="px-4 py-2.5">Código</th>
                    <th className="px-4 py-2.5">Tipo</th>
                    <th className="px-4 py-2.5">Status</th>
                    {canSeeFinancial && <th className="px-4 py-2.5">CMV total</th>}
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {loads.map((l) => (
                    <tr key={l.id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50">
                      <td className="px-4 py-2.5 font-medium text-zinc-800">{l.codigo_interno}</td>
                      <td className="px-4 py-2.5 text-zinc-600">{l.tipo === 'FULL_MARKETPLACE' ? 'Full' : 'Loja'}</td>
                      <td className="px-4 py-2.5"><Badge tone={loadStatusTone(l.status)} dot>{l.status}</Badge></td>
                      {canSeeFinancial && <td className="px-4 py-2.5 text-zinc-600">{Number(l.cmv_total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>}
                      <td className="px-4 py-2.5 text-right">
                        <button className="font-medium text-brand-600 hover:text-brand-700" onClick={() => openLoad(l)}>Detalhe</button>
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
        onClose={() => setShowCreate(false)}
        title="Nova carga"
        size="lg"
        footer={canWrite && <Button variant="primary" onClick={createLoad}>Criar carga</Button>}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <FieldGroup label="Tipo">
              <Select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} disabled={profile.perfil === 'gerente_ecommerce'}>
                <option value="LOJA_FISICA">Loja física</option>
                <option value="FULL_MARKETPLACE">Full Marketplace</option>
              </Select>
            </FieldGroup>
            <FieldGroup label="Empresa">
              <Select value={form.empresa_id ?? ''} onChange={(e) => setForm({ ...form, empresa_id: e.target.value })}>
                <option value="">Selecionar</option>
                {options.companies.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </Select>
            </FieldGroup>
            <FieldGroup label="Canal">
              <Select value={form.canal_id ?? ''} onChange={(e) => setForm({ ...form, canal_id: e.target.value })}>
                <option value="">Selecionar</option>
                {options.channels.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
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
                <FieldGroup label="Nº carga marketplace">
                  <Input value={form.numero_carga_marketplace ?? ''} onChange={(e) => setForm({ ...form, numero_carga_marketplace: e.target.value })} />
                </FieldGroup>
                <FieldGroup label="Código de agendamento">
                  <Input value={form.codigo_agendamento ?? ''} onChange={(e) => setForm({ ...form, codigo_agendamento: e.target.value })} />
                </FieldGroup>
              </>
            )}
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
            <FieldGroup label="Prioridade">
              <Select value={form.prioridade} onChange={(e) => setForm({ ...form, prioridade: e.target.value })}>
                <option value="Baixa">Baixa</option>
                <option value="Média">Média</option>
                <option value="Alta">Alta</option>
                <option value="Urgente">Urgente</option>
              </Select>
            </FieldGroup>
            <FieldGroup label="Data agendada">
              <Input type="datetime-local" value={toDatetimeLocalValue(form.data_agendada)} onChange={(e) => setForm({ ...form, data_agendada: fromDatetimeLocalValue(e.target.value) ?? '' })} />
            </FieldGroup>
            <FieldGroup label="Previsão de recebimento">
              <Input type="datetime-local" value={toDatetimeLocalValue(form.data_prevista_recebimento)} onChange={(e) => setForm({ ...form, data_prevista_recebimento: fromDatetimeLocalValue(e.target.value) ?? '' })} />
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
            {canEditFinancial && (
              <>
                <FieldGroup label="Faturamento estimado">
                  <Input type="number" value={form.faturamento_estimado ?? ''} onChange={(e) => setForm({ ...form, faturamento_estimado: e.target.value })} />
                </FieldGroup>
                <FieldGroup label="Custo de frete">
                  <Input type="number" value={form.custo_frete} onChange={(e) => setForm({ ...form, custo_frete: e.target.value })} />
                </FieldGroup>
                <FieldGroup label="Outros custos">
                  <Input type="number" value={form.outros_custos} onChange={(e) => setForm({ ...form, outros_custos: e.target.value })} />
                </FieldGroup>
              </>
            )}
            <FieldGroup label="Observações" className="md:col-span-3">
              <Textarea value={form.observacoes ?? ''} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
            </FieldGroup>
          </div>

          <div className="border-t border-zinc-100 pt-4">
            <h3 className="mb-2 text-sm font-semibold text-zinc-700">Primeiro item da carga</h3>
            <LoadItemFields value={newItem} onChange={(field, value) => setNewItem((prev) => ({ ...prev, [field]: value }))} suppliers={options.suppliers} showFinancial={canSeeFinancial} />
            {canSeeFinancial && Number(newItem.cmv_unitario || 0) <= 0 && (
              <p className="mt-2 flex items-center gap-1 text-xs text-amber-600"><AlertTriangle className="h-3.5 w-3.5" />Produto sem CMV cadastrado — a margem pode ficar incorreta.</p>
            )}
          </div>
        </div>
      </Dialog>

      <Dialog
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.codigo_interno ?? ''}
        description={selected ? <Badge tone={loadStatusTone(selected.status)} dot>{selected.status}</Badge> : undefined}
        size="lg"
      >
        {selected && (
          <div className="space-y-5">
            <p className="text-xs text-zinc-500">Cargas agendadas antes do recebimento e finalizações sem NF são permitidas, mas geram alerta.</p>

            {canWrite && (
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
                <FieldGroup label="Previsão de recebimento">
                  <Input type="datetime-local" value={toDatetimeLocalValue(selected.data_prevista_recebimento)} onChange={(e) => setSelected({ ...selected, data_prevista_recebimento: fromDatetimeLocalValue(e.target.value) })} />
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
            )}

            {canEditFinancial && (
              <div className="rounded-lg bg-zinc-50 p-3">
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
                <h3 className="text-sm font-semibold text-zinc-700">Itens da carga</h3>
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
                      <th className="px-3 py-2">Qtd</th>
                      {canSeeFinancial && <th className="px-3 py-2">CMV unit.</th>}
                      {canSeeFinancial && <th className="px-3 py-2">CMV total</th>}
                      <th className="px-3 py-2">Cubagem</th>
                      {canWrite && <th className="px-3 py-2" />}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((i) => (
                      <tr key={i.id} className="border-b border-zinc-50 last:border-0">
                        <td className="px-3 py-2">{i.sku}</td>
                        <td className="px-3 py-2">{i.nome_produto}</td>
                        <td className="px-3 py-2">{i.quantidade}</td>
                        {canSeeFinancial && <td className="px-3 py-2">{i.cmv_unitario}</td>}
                        {canSeeFinancial && <td className="px-3 py-2">{i.cmv_total}</td>}
                        <td className="px-3 py-2">{i.cubagem ?? '-'}</td>
                        {canWrite && (
                          <td className="space-x-2 px-3 py-2 text-right">
                            {removingItemId === i.id ? (
                              <>
                                <button className="font-medium text-rose-700 hover:text-rose-800" onClick={() => removeItem(i)}>Confirmar remoção</button>
                                <button className="font-medium text-zinc-500 hover:text-zinc-700" onClick={() => setRemovingItemId(null)}>Cancelar</button>
                              </>
                            ) : (
                              <>
                                <button className="font-medium text-brand-600 hover:text-brand-700" onClick={() => editItem(i)}>Editar</button>
                                <button className="font-medium text-rose-600 hover:text-rose-700" onClick={() => removeItem(i)}>Remover</button>
                              </>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                    {items.length === 0 && (
                      <tr><td colSpan={canSeeFinancial ? 7 : 5} className="px-3 py-4 text-center text-zinc-400">Nenhum item ainda.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {canWrite && (
                <div className="mt-3 rounded-lg border border-dashed border-zinc-200 p-3">
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Adicionar item</h4>
                  <LoadItemFields value={detailNewItem} onChange={(field, value) => setDetailNewItem((prev) => ({ ...prev, [field]: value }))} suppliers={options.suppliers} showFinancial={canSeeFinancial} />
                  <Button variant="secondary" className="mt-2" onClick={addItem}>Adicionar item</Button>
                </div>
              )}

              {editingItem && canWrite && (
                <div className="mt-3 rounded-lg bg-zinc-50 p-3">
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Editar item</h4>
                  <LoadItemFields value={editingItem} onChange={(field, value) => setEditingItem((prev) => (prev ? { ...prev, [field]: value } : prev))} suppliers={options.suppliers} showFinancial={canSeeFinancial} />
                  <div className="mt-2 flex gap-2">
                    <Button variant="primary" onClick={saveEditingItem}>Salvar item</Button>
                    <Button variant="ghost" onClick={() => setEditingItem(null)}>Cancelar</Button>
                  </div>
                </div>
              )}
            </div>

            {canSeeFinancial && (
              <div className="grid grid-cols-3 gap-3 rounded-lg bg-zinc-50 p-3 text-sm">
                <div><div className="text-xs text-zinc-500">CMV total</div><div className="font-semibold">{totals.cmv.toFixed(2)}</div></div>
                <div><div className="text-xs text-zinc-500">Margem (valor)</div><div className={`font-semibold ${totals.margemValor >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{totals.margemValor.toFixed(2)}</div></div>
                <div><div className="text-xs text-zinc-500">Margem (%)</div><div className="font-semibold">{totals.margemPct === null ? 'pendente' : `${(totals.margemPct * 100).toFixed(2)}%`}</div></div>
              </div>
            )}

            {checklist && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-zinc-700">Checklist operacional</h3>
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
    </div>
  );
}
