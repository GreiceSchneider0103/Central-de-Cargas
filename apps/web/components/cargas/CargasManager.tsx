'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { UserProfile } from '@/lib/auth/roles';
import { LOAD_STATUSES } from '@/lib/loads/statuses';

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

const PAGE_SIZE = 50;

export function CargasManager({ profile }: { profile: UserProfile }) {
  const supabase = createClient();
  const [loads, setLoads] = useState<LoadRow[]>([]);
  const [selected, setSelected] = useState<LoadRow | null>(null);
  const [items, setItems] = useState<LoadItemRow[]>([]);
  const [checklist, setChecklist] = useState<ChecklistRow | null>(null);
  const [form, setForm] = useState<Record<string, string | number>>({ tipo: 'LOJA_FISICA', status: 'Rascunho', prioridade: 'Média', custo_frete: 0, outros_custos: 0 });
  const [newItem, setNewItem] = useState<Record<string, string | number>>({ sku: '', nome_produto: '', quantidade: 1, cmv_unitario: 0 });
  const [editingItem, setEditingItem] = useState<LoadItemRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<{ companies: Option[]; channels: Option[]; stores: Option[]; destinations: Option[]; cds: Option[]; suppliers: Option[]; transports: Option[]; profiles: Option[] }>({ companies: [], channels: [], stores: [], destinations: [], cds: [], suppliers: [], transports: [], profiles: [] });
  const [page, setPage] = useState(0);
  const [totalLoads, setTotalLoads] = useState(0);

  const canWrite = ['admin', 'gerente_estoque', 'gerente_ecommerce'].includes(profile.perfil);
  const canChecklist = ['admin', 'gerente_estoque', 'operador_carga'].includes(profile.perfil);
  const canSeeFinancial = ['admin', 'gerente_estoque', 'gerente_ecommerce', 'financeiro'].includes(profile.perfil);
  const canEditFinancialOnly = profile.perfil === 'financeiro';
  const canEditFinancial = canSeeFinancial && (canWrite || canEditFinancialOnly);

  const loadData = useCallback(async () => {
    const { data } = await supabase.rpc('get_visible_loads_page', { p_page: page + 1, p_page_size: PAGE_SIZE });
    const rows = (data ?? []) as (LoadRow & { total_count?: number })[];
    setLoads(rows);
    setTotalLoads(Number(rows[0]?.total_count ?? 0));
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
    setError(null);
    if (!newItem.sku || !newItem.nome_produto || Number(newItem.quantidade || 0) <= 0) {
      setError('Informe ao menos um item com SKU, nome e quantidade maior que zero.');
      return;
    }
    if (profile.perfil === 'gerente_ecommerce' && form.tipo !== 'FULL_MARKETPLACE') {
      setError('Gerente e-commerce pode criar apenas cargas FULL.');
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
	          custo_frete: Number(form.custo_frete || 0),
	          outros_custos: Number(form.outros_custos || 0),
	          faturamento_estimado: form.faturamento_estimado ? Number(form.faturamento_estimado) : null,
	          numero_carga_marketplace: form.numero_carga_marketplace || null,
	          codigo_agendamento: form.codigo_agendamento || null,
	          tipo_coleta_id: form.tipo_coleta_id || null,
	          transportador_id: form.transportador_id || null,
	          observacoes: form.observacoes || null,
	        },
	        items: [{
	          ...newItem,
	          quantidade: Number(newItem.quantidade || 0),
	          cmv_unitario: Number(newItem.cmv_unitario || 0),
	          peso: newItem.peso ?? null,
	          altura: newItem.altura ?? null,
	          largura: newItem.largura ?? null,
	          profundidade: newItem.profundidade ?? null,
	          data_prevista_recebimento: newItem.data_prevista_recebimento ?? null,
	          data_real_recebimento: newItem.data_real_recebimento ?? null,
	          status_item: newItem.status_item ?? null,
	          observacao: newItem.observacao ?? null,
	        }],
	      }),
	    });

    const result = await response.json();
    if (!response.ok) return setError(result.error || 'Erro ao criar carga.');

    setNewItem({ sku: '', nome_produto: '', quantidade: 1, cmv_unitario: 0 });
    await loadData();
  }

  async function openLoad(load: LoadRow) {
    setSelected(load);
    const [it, chk] = await Promise.all([
      supabase.rpc('get_visible_load_items', { p_load_id: load.id }),
      supabase.from('load_checklists').select('*').eq('load_id', load.id).single(),
    ]);
    setItems((it.data ?? []) as LoadItemRow[]);
    setChecklist(chk.data as ChecklistRow | null);
  }

  async function addItem() {
    if (!selected || !canWrite) return;
    const { data: productRows } = await supabase.rpc('get_visible_product_by_sku', { p_sku: String(newItem.sku) });
    const product = Array.isArray(productRows) ? productRows[0] : null;
    const payload = {
      load_id: selected.id,
      product_id: product?.id ?? null,
      sku: newItem.sku,
      nome_produto: newItem.nome_produto || product?.nome,
      quantidade: Number(newItem.quantidade),
      fornecedor_origem_id: newItem.fornecedor_origem_id || null,
      cmv_unitario: Number(newItem.cmv_unitario || product?.cmv || 0),
      altura: newItem.altura ? Number(newItem.altura) : null,
	      largura: newItem.largura ? Number(newItem.largura) : null,
	      profundidade: newItem.profundidade ? Number(newItem.profundidade) : null,
	      peso: newItem.peso ? Number(newItem.peso) : null,
	      data_prevista_recebimento: newItem.data_prevista_recebimento || null,
	      data_real_recebimento: newItem.data_real_recebimento || null,
	      status_item: newItem.status_item || null,
	      observacao: newItem.observacao || null,
	    };
    const res = await fetch(`/api/loads/${selected.id}/items`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) { const j = await res.json(); return setError(j.error || 'Erro ao adicionar item.'); }
    setNewItem({ sku: '', nome_produto: '', quantidade: 1, cmv_unitario: 0 });
    await openLoad(selected);
    await loadData();
  }

  function editItem(item: LoadItemRow) {
    setEditingItem(item);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async function legacyQuickEditItem(item: LoadItemRow) {
    if (!selected || !canWrite) return;
    const quantidade = prompt('Quantidade', String(item.quantidade ?? 1));
    if (!quantidade) return;
    const cmv = canSeeFinancial ? prompt('CMV unitário', String(item.cmv_unitario ?? 0)) : String(item.cmv_unitario ?? 0);
    const res = await fetch(`/api/loads/${selected.id}/items`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...item, quantidade: Number(quantidade), cmv_unitario: Number(cmv || 0) }),
    });
    if (!res.ok) { const j = await res.json(); setError(j.error || 'Erro ao editar item.'); return; }
    await openLoad(selected);
    await loadData();
  }

  async function saveEditingItem() {
    if (!selected || !canWrite || !editingItem) return;
    const res = await fetch(`/api/loads/${selected.id}/items`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...editingItem,
        id: editingItem.id,
        quantidade: Number(editingItem.quantidade ?? 0),
        cmv_unitario: canSeeFinancial ? Number(editingItem.cmv_unitario ?? 0) : Number(editingItem.cmv_unitario ?? 0),
      }),
    });
    if (!res.ok) { const j = await res.json(); setError(j.error || 'Erro ao editar item.'); return; }
    setEditingItem(null);
    await openLoad(selected);
    await loadData();
  }

  async function removeItem(item: LoadItemRow) {
    if (!selected || !canWrite || !confirm('Remover item da carga?')) return;
    const res = await fetch(`/api/loads/${selected.id}/items?itemId=${item.id}`, { method: 'DELETE' });
    if (!res.ok) { const j = await res.json(); setError(j.error || 'Erro ao remover item.'); return; }
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
    if (!res.ok) { const j = await res.json(); setError(j.error || 'Erro ao atualizar carga.'); return; }
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
    if (!res.ok) { const j = await res.json(); setError(j.error || 'Erro ao atualizar financeiro.'); return; }
    await openLoad(selected);
    await loadData();
  }

  async function toggleChecklist(field: string, value: boolean) {
    if (!selected || !checklist || !canChecklist) return;
    const res = await fetch(`/api/loads/${selected.id}/checklist`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ field, value }) });
    if (!res.ok) { const j = await res.json(); setError(j.error || 'Erro checklist'); return; }
    await openLoad(selected);
  }

  async function cancelLoad() {
    if (!selected || !canWrite) return;
    const motivo = prompt('Motivo do cancelamento');
    if (!motivo) return;
    const res = await fetch(`/api/loads/${selected.id}/cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ motivo }) });
    if (!res.ok) { const j = await res.json(); setError(j.error || 'Erro cancelamento'); return; }
    await openLoad({ ...selected, status: 'Cancelada' });
    await loadData();
  }

  async function finalizeLoad() {
    if (!selected || !canWrite) return;
    if (checklist && !checklist.nf_emitida && !confirm('NF não emitida. Deseja finalizar mesmo assim?')) return;
    const res = await fetch(`/api/loads/${selected.id}/finalize`, { method: 'POST' });
    const j = await res.json();
    if (!res.ok) { setError(j.error || 'Erro finalização'); return; }
    if (j.warning) alert('Alerta: finalizada sem NF emitida');
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

  return <div className="space-y-6">
    <div className="bg-white border rounded-xl p-4 space-y-3">
      <h2 className="font-semibold">Nova carga</h2>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <select className="h-10 border rounded px-2" value={form.tipo} onChange={e=>setForm({...form,tipo:e.target.value})} disabled={profile.perfil === 'gerente_ecommerce'}><option value="LOJA_FISICA">Loja</option><option value="FULL_MARKETPLACE">Full</option></select>
        <select className="h-10 border rounded px-2" onChange={e=>setForm({...form,empresa_id:e.target.value})}><option value="">Empresa</option>{options.companies.map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}</select>
        <select className="h-10 border rounded px-2" onChange={e=>setForm({...form,canal_id:e.target.value})}><option value="">Canal</option>{options.channels.map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}</select>
        <select className="h-10 border rounded px-2" onChange={e=>setForm({...form,loja_destino_id:e.target.value})}><option value="">Loja destino</option>{options.stores.map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}</select>
        <select className="h-10 border rounded px-2" onChange={e=>setForm({...form,marketplace_id:e.target.value})}><option value="">Marketplace</option>{options.channels.filter(o=>o.tipo==='Marketplace Full').map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}</select>
        <select className="h-10 border rounded px-2" onChange={e=>setForm({...form,destino_full_id:e.target.value})}><option value="">Destino Full</option>{options.destinations.map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}</select>
        <input className="h-10 border rounded px-2" placeholder="Número marketplace" onChange={e=>setForm({...form,numero_carga_marketplace:e.target.value})}/>
        <input className="h-10 border rounded px-2" placeholder="Código agendamento" onChange={e=>setForm({...form,codigo_agendamento:e.target.value})}/>
        <select className="h-10 border rounded px-2" onChange={e=>setForm({...form,cd_origem_id:e.target.value})}><option value="">CD origem</option>{options.cds.map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}</select>
        <select className="h-10 border rounded px-2" onChange={e=>setForm({...form,responsavel_operacional_id:e.target.value})}>
          <option value="">Responsável</option>
          {options.profiles.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
        <input className="h-10 border rounded px-2" placeholder="Data agendada (ISO)" onChange={e=>setForm({...form,data_agendada:e.target.value})}/>
        <input className="h-10 border rounded px-2" placeholder="Prev. recebimento (ISO)" onChange={e=>setForm({...form,data_prevista_recebimento:e.target.value})}/>
        <input className="h-10 border rounded px-2" placeholder="Real recebimento (ISO)" onChange={e=>setForm({...form,data_real_recebimento:e.target.value})}/>
        <select className="h-10 border rounded px-2" onChange={e=>setForm({...form,tipo_coleta_id:e.target.value})}><option value="">Tipo de coleta</option>{options.transports.map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}</select>
        <select className="h-10 border rounded px-2" onChange={e=>setForm({...form,transportador_id:e.target.value})}><option value="">Transportador</option>{options.transports.map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}</select>
        {canEditFinancial && <input className="h-10 border rounded px-2" placeholder="Faturamento estimado" type="number" onChange={e=>setForm({...form,faturamento_estimado:e.target.value})}/>}
        {canEditFinancial && <input className="h-10 border rounded px-2" placeholder="Custo frete" type="number" onChange={e=>setForm({...form,custo_frete:e.target.value})}/>}
        {canEditFinancial && <input className="h-10 border rounded px-2" placeholder="Outros custos" type="number" onChange={e=>setForm({...form,outros_custos:e.target.value})}/>}
        <input className="h-10 border rounded px-2" placeholder="Observações" onChange={e=>setForm({...form,observacoes:e.target.value})}/>
        <select className="h-10 border rounded px-2" value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{LOAD_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <input className="h-10 border rounded px-2" placeholder="SKU item inicial" value={newItem.sku||''} onChange={e=>setNewItem({...newItem,sku:e.target.value})}/>
        <input className="h-10 border rounded px-2" placeholder="Nome item inicial" value={newItem.nome_produto||''} onChange={e=>setNewItem({...newItem,nome_produto:e.target.value})}/>
        <input className="h-10 border rounded px-2" placeholder="Quantidade" type="number" value={newItem.quantidade||1} onChange={e=>setNewItem({...newItem,quantidade:e.target.value})}/>
        <select className="h-10 border rounded px-2" value={newItem.fornecedor_origem_id||''} onChange={e=>setNewItem({...newItem,fornecedor_origem_id:e.target.value})}><option value="">Fornecedor</option>{options.suppliers.map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}</select>
        <input className="h-10 border rounded px-2" placeholder="Peso" type="number" onChange={e=>setNewItem({...newItem,peso:e.target.value})}/>
        <input className="h-10 border rounded px-2" placeholder="-" value="" readOnly />
        <input className="h-10 border rounded px-2" placeholder="Largura" type="number" onChange={e=>setNewItem({...newItem,largura:e.target.value})}/>
        <input className="h-10 border rounded px-2" placeholder="Profundidade" type="number" onChange={e=>setNewItem({...newItem,profundidade:e.target.value})}/>
        <input className="h-10 border rounded px-2" placeholder="Prev. receb. item (ISO)" onChange={e=>setNewItem({...newItem,data_prevista_recebimento:e.target.value})}/>
        <input className="h-10 border rounded px-2" placeholder="Real receb. item (ISO)" onChange={e=>setNewItem({...newItem,data_real_recebimento:e.target.value})}/>
        <input className="h-10 border rounded px-2" placeholder="Status item" onChange={e=>setNewItem({...newItem,status_item:e.target.value})}/>
        <input className="h-10 border rounded px-2" placeholder="Observação item" onChange={e=>setNewItem({...newItem,observacao:e.target.value})}/>
        <input className="h-10 border rounded px-2" placeholder="Peso" type="number" onChange={e=>setNewItem({...newItem,peso:e.target.value})}/>
        <input className="h-10 border rounded px-2" placeholder="Altura" type="number" onChange={e=>setNewItem({...newItem,altura:e.target.value})}/>
        <input className="h-10 border rounded px-2" placeholder="Largura" type="number" onChange={e=>setNewItem({...newItem,largura:e.target.value})}/>
        <input className="h-10 border rounded px-2" placeholder="Profundidade" type="number" onChange={e=>setNewItem({...newItem,profundidade:e.target.value})}/>
        <input className="h-10 border rounded px-2" placeholder="Prev. receb. item (ISO)" onChange={e=>setNewItem({...newItem,data_prevista_recebimento:e.target.value})}/>
        <input className="h-10 border rounded px-2" placeholder="Real receb. item (ISO)" onChange={e=>setNewItem({...newItem,data_real_recebimento:e.target.value})}/>
        <input className="h-10 border rounded px-2" placeholder="Status item" onChange={e=>setNewItem({...newItem,status_item:e.target.value})}/>
        <input className="h-10 border rounded px-2" placeholder="Observação item" onChange={e=>setNewItem({...newItem,observacao:e.target.value})}/>
        <input className="h-10 border rounded px-2" placeholder="Peso" type="number" onChange={e=>setNewItem({...newItem,peso:e.target.value})}/>
        <input className="h-10 border rounded px-2" placeholder="-" value="" readOnly />
        <input className="h-10 border rounded px-2" placeholder="Largura" type="number" onChange={e=>setNewItem({...newItem,largura:e.target.value})}/>
        <input className="h-10 border rounded px-2" placeholder="Profundidade" type="number" onChange={e=>setNewItem({...newItem,profundidade:e.target.value})}/>
        <input className="h-10 border rounded px-2" placeholder="Prev. receb. item (ISO)" onChange={e=>setNewItem({...newItem,data_prevista_recebimento:e.target.value})}/>
        <input className="h-10 border rounded px-2" placeholder="Real receb. item (ISO)" onChange={e=>setNewItem({...newItem,data_real_recebimento:e.target.value})}/>
        <input className="h-10 border rounded px-2" placeholder="Status item" onChange={e=>setNewItem({...newItem,status_item:e.target.value})}/>
        <input className="h-10 border rounded px-2" placeholder="Observação item" onChange={e=>setNewItem({...newItem,observacao:e.target.value})}/>
        {canSeeFinancial && <input className="h-10 border rounded px-2" placeholder="CMV unitário" type="number" value={newItem.cmv_unitario||0} onChange={e=>setNewItem({...newItem,cmv_unitario:e.target.value})}/>}
      </div>
      {canWrite && <button className="px-3 py-2 bg-indigo-600 text-white rounded" onClick={createLoad}>Criar carga</button>}
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>

    <div className="bg-white border rounded-xl p-4">
      <h2 className="font-semibold mb-2">Lista de cargas</h2>
      <table className="w-full text-sm"><thead><tr className="border-b"><th>Código</th><th>Tipo</th><th>Status</th>{canSeeFinancial && <th>CMV total</th>}<th>Ações</th></tr></thead><tbody>
        {loads.map(l => <tr key={l.id} className="border-b"><td>{l.codigo_interno}</td><td>{l.tipo}</td><td>{l.status}</td>{canSeeFinancial && <td>{Number(l.cmv_total||0).toFixed(2)}</td>}<td><button className="text-indigo-600" onClick={()=>openLoad(l)}>Detalhe</button></td></tr>)}
      </tbody></table>
      <div className="flex gap-2 mt-3 text-sm">
        <button className="px-2 py-1 border rounded disabled:opacity-50" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Anterior</button>
        <span className="py-1">Página {page + 1} de {totalLoadPages} ({totalLoads} cargas)</span>
        <button className="px-2 py-1 border rounded disabled:opacity-50" disabled={page + 1 >= totalLoadPages} onClick={() => setPage((p) => p + 1)}>Próxima</button>
      </div>
    </div>

    {selected && <div className="bg-white border rounded-xl p-4 space-y-4">
      <h3 className="font-semibold">{selected.codigo_interno} • {selected.status}</h3>
      <p className="text-sm text-zinc-600">Aviso: cargas agendadas antes do recebimento e finalização sem NF são permitidas com alerta.</p>
      {canWrite && <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <select className="h-10 border rounded px-2" value={selected.status || ''} onChange={e=>setSelected({...selected,status:e.target.value})}>{LOAD_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}</select>
        <input className="h-10 border rounded px-2" placeholder="Prioridade" value={selected.prioridade || ''} onChange={e=>setSelected({...selected,prioridade:e.target.value})}/>
        <input className="h-10 border rounded px-2" placeholder="Data agendada ISO" value={selected.data_agendada || ''} onChange={e=>setSelected({...selected,data_agendada:e.target.value})}/>
        <button className="px-3 py-2 border rounded" onClick={patchSelectedLoad}>Salvar dados da carga</button>
      </div>}

      {canWrite && <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-sm">
        <select className="h-10 border rounded px-2" value={String(selected.responsavel_operacional_id ?? '')} onChange={e=>setSelected({...selected,responsavel_operacional_id:e.target.value || null})}>
          <option value="">Responsável</option>
          {options.profiles.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
        <select className="h-10 border rounded px-2" value={String(selected.cd_origem_id ?? '')} onChange={e=>setSelected({...selected,cd_origem_id:e.target.value || null})}><option value="">CD origem</option>{options.cds.map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}</select>
        <select className="h-10 border rounded px-2" value={String(selected.tipo_coleta_id ?? '')} onChange={e=>setSelected({...selected,tipo_coleta_id:e.target.value || null})}><option value="">Tipo de coleta</option>{options.transports.map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}</select>
        <select className="h-10 border rounded px-2" value={String(selected.transportador_id ?? '')} onChange={e=>setSelected({...selected,transportador_id:e.target.value || null})}><option value="">Transportador</option>{options.transports.map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}</select>
        <input className="h-10 border rounded px-2" placeholder="Prev. recebimento (ISO)" value={String(selected.data_prevista_recebimento ?? '')} onChange={e=>setSelected({...selected,data_prevista_recebimento:e.target.value || null})}/>
        <input className="h-10 border rounded px-2" placeholder="Real recebimento (ISO)" value={String(selected.data_real_recebimento ?? '')} onChange={e=>setSelected({...selected,data_real_recebimento:e.target.value || null})}/>
        <input className="h-10 border rounded px-2" placeholder="Número marketplace" value={String(selected.numero_carga_marketplace ?? '')} onChange={e=>setSelected({...selected,numero_carga_marketplace:e.target.value || null})}/>
        <input className="h-10 border rounded px-2" placeholder="Código agendamento" value={String(selected.codigo_agendamento ?? '')} onChange={e=>setSelected({...selected,codigo_agendamento:e.target.value || null})}/>
      </div>}

      {canEditFinancial && <div className="bg-zinc-50 p-3 rounded space-y-2">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input className="h-10 border rounded px-2" placeholder="Faturamento estimado" type="number" value={Number(selected.faturamento_estimado ?? 0)} onChange={e=>setSelected({...selected,faturamento_estimado:Number(e.target.value)})}/>
          <input className="h-10 border rounded px-2" placeholder="Custo frete" type="number" value={Number(selected.custo_frete ?? 0)} onChange={e=>setSelected({...selected,custo_frete:Number(e.target.value)})}/>
          <input className="h-10 border rounded px-2" placeholder="Outros custos" type="number" value={Number(selected.outros_custos ?? 0)} onChange={e=>setSelected({...selected,outros_custos:Number(e.target.value)})}/>
        </div>
        <button className="px-3 py-2 border rounded" onClick={patchSelectedFinancial}>Salvar financeiro</button>
      </div>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <input className="h-10 border rounded px-2" placeholder="SKU" value={newItem.sku||''} onChange={e=>setNewItem({...newItem,sku:e.target.value})}/>
        <input className="h-10 border rounded px-2" placeholder="Nome produto" value={newItem.nome_produto||''} onChange={e=>setNewItem({...newItem,nome_produto:e.target.value})}/>
        <input className="h-10 border rounded px-2" placeholder="Quantidade" type="number" value={newItem.quantidade||1} onChange={e=>setNewItem({...newItem,quantidade:e.target.value})}/>
        <select className="h-10 border rounded px-2" value={newItem.fornecedor_origem_id||''} onChange={e=>setNewItem({...newItem,fornecedor_origem_id:e.target.value})}><option value="">Fornecedor</option>{options.suppliers.map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}</select>
        {canSeeFinancial && <input className="h-10 border rounded px-2" placeholder="CMV unitário" type="number" value={newItem.cmv_unitario||0} onChange={e=>setNewItem({...newItem,cmv_unitario:e.target.value})}/>}
        <input className="h-10 border rounded px-2" placeholder="Altura" type="number" onChange={e=>setNewItem({...newItem,altura:e.target.value})}/>
      </div>
      {canSeeFinancial && Number(newItem.cmv_unitario||0)<=0 && <p className='text-xs text-amber-600'>Produto sem CMV, preencher manualmente.</p>}
      {canWrite && <button className="px-3 py-2 border rounded" onClick={addItem}>Adicionar item</button>}

      {editingItem && canWrite && (
        <div className="bg-zinc-50 p-3 rounded space-y-2 text-sm">
          <h4 className="font-semibold">Editar item</h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <input className="h-10 border rounded px-2" placeholder="SKU" value={String(editingItem.sku ?? '')} onChange={e=>setEditingItem({ ...editingItem, sku: e.target.value })} />
            <input className="h-10 border rounded px-2" placeholder="Nome" value={String(editingItem.nome_produto ?? '')} onChange={e=>setEditingItem({ ...editingItem, nome_produto: e.target.value })} />
            <input className="h-10 border rounded px-2" placeholder="Quantidade" type="number" value={Number(editingItem.quantidade ?? 0)} onChange={e=>setEditingItem({ ...editingItem, quantidade: Number(e.target.value) })} />
            <select className="h-10 border rounded px-2" value={String(editingItem.fornecedor_origem_id ?? '')} onChange={e=>setEditingItem({ ...editingItem, fornecedor_origem_id: e.target.value || null })}><option value="">Fornecedor</option>{options.suppliers.map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}</select>
            {canSeeFinancial && <input className="h-10 border rounded px-2" placeholder="CMV unitário" type="number" value={Number(editingItem.cmv_unitario ?? 0)} onChange={e=>setEditingItem({ ...editingItem, cmv_unitario: Number(e.target.value) })} />}
            <input className="h-10 border rounded px-2" placeholder="Peso" type="number" value={Number(editingItem.peso ?? 0)} onChange={e=>setEditingItem({ ...editingItem, peso: Number(e.target.value) })} />
            <input className="h-10 border rounded px-2" placeholder="Altura" type="number" value={Number(editingItem.altura ?? 0)} onChange={e=>setEditingItem({ ...editingItem, altura: Number(e.target.value) })} />
            <input className="h-10 border rounded px-2" placeholder="Largura" type="number" value={Number(editingItem.largura ?? 0)} onChange={e=>setEditingItem({ ...editingItem, largura: Number(e.target.value) })} />
            <input className="h-10 border rounded px-2" placeholder="Profundidade" type="number" value={Number(editingItem.profundidade ?? 0)} onChange={e=>setEditingItem({ ...editingItem, profundidade: Number(e.target.value) })} />
            <input className="h-10 border rounded px-2" placeholder="Prev. receb. (ISO)" value={String(editingItem.data_prevista_recebimento ?? '')} onChange={e=>setEditingItem({ ...editingItem, data_prevista_recebimento: e.target.value })} />
            <input className="h-10 border rounded px-2" placeholder="Real receb. (ISO)" value={String(editingItem.data_real_recebimento ?? '')} onChange={e=>setEditingItem({ ...editingItem, data_real_recebimento: e.target.value })} />
            <input className="h-10 border rounded px-2" placeholder="Status item" value={String(editingItem.status_item ?? '')} onChange={e=>setEditingItem({ ...editingItem, status_item: e.target.value })} />
            <input className="h-10 border rounded px-2" placeholder="Observação" value={String(editingItem.observacao ?? '')} onChange={e=>setEditingItem({ ...editingItem, observacao: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-2 border rounded" onClick={saveEditingItem}>Salvar item</button>
            <button className="px-3 py-2 border rounded" onClick={() => setEditingItem(null)}>Cancelar</button>
          </div>
        </div>
      )}

      <table className="w-full text-sm"><thead><tr className="border-b"><th>SKU</th><th>Nome</th><th>Qtd</th>{canSeeFinancial && <th>CMV unit</th>}{canSeeFinancial && <th>CMV total</th>}<th>Cubagem</th>{canWrite && <th>Ações</th>}</tr></thead><tbody>
        {items.map(i=><tr key={i.id} className="border-b"><td>{i.sku}</td><td>{i.nome_produto}</td><td>{i.quantidade}</td>{canSeeFinancial && <td>{i.cmv_unitario}</td>}{canSeeFinancial && <td>{i.cmv_total}</td>}<td>{i.cubagem ?? '-'}</td>{canWrite && <td className="space-x-2"><button className="text-indigo-600" onClick={()=>editItem(i)}>Editar</button><button className="text-rose-700" onClick={()=>removeItem(i)}>Remover</button></td>}</tr>)}
      </tbody></table>

      {canSeeFinancial && <div className="bg-zinc-50 p-3 rounded text-sm">
        <p>CMV total: {totals.cmv.toFixed(2)}</p>
        <p>Margem estimativa (valor): {totals.margemValor.toFixed(2)}</p>
        <p>Margem estimativa (%): {totals.margemPct === null ? '-' : (totals.margemPct*100).toFixed(2) + '%'}</p>
      </div>}

      {checklist && <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
        {['pedido_realizado','pedido_confirmado_fornecedor','produto_recebido','montada','agendada','etiqueta_impressa','carga_separada','carga_etiquetada','nf_emitida','carga_carregada','finalizada'].map((k)=><label key={k} className="flex items-center gap-2"><input type="checkbox" checked={!!checklist[k]} onChange={e=>toggleChecklist(k,e.target.checked)} disabled={!canChecklist}/>{k}</label>)}
      </div>}

      <div className="flex gap-2">
        {canWrite && <button className="px-3 py-2 bg-rose-600 text-white rounded" onClick={cancelLoad}>Cancelar carga</button>}
        {canWrite && <button className="px-3 py-2 bg-emerald-600 text-white rounded" onClick={finalizeLoad}>Finalizar carga</button>}
      </div>
    </div>}
  </div>;
}
