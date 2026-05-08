'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { UserProfile } from '@/lib/auth/roles';

export function CargasManager({ profile }: { profile: UserProfile }) {
  const supabase = createClient();
  const [loads, setLoads] = useState<unknown[]>([]);
  const [selected, setSelected] = useState<unknown | null>(null);
  const [items, setItems] = useState<unknown[]>([]);
  const [checklist, setChecklist] = useState<unknown | null>(null);
  const [form, setForm] = useState<Record<string, string | number>>({ tipo: 'LOJA_FISICA', status: 'Rascunho', prioridade: 'Média', custo_frete: 0, outros_custos: 0 });
  const [newItem, setNewItem] = useState<Record<string, string | number>>({ sku: '', nome_produto: '', quantidade: 1, cmv_unitario: 0 });
  const [error, setError] = useState<string | null>(null);

  const canWrite = ['admin', 'gerente_estoque', 'gerente_ecommerce'].includes(profile.perfil);
  const canChecklist = ['admin', 'gerente_estoque', 'operador_carga'].includes(profile.perfil);

  const loadData = useCallback(async () => {
    const { data } = await supabase.from('loads').select('*').order('created_at', { ascending: false });
    setLoads(data ?? []);
  }, [supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  async function createLoad() {
    if (!canWrite) return;
    setError(null);
    const authUser = (await supabase.auth.getUser()).data.user;
    const { data: me } = await supabase.from('users_profile').select('id').eq('auth_user_id', authUser?.id ?? '').single();

    const { data, error } = await supabase.from('loads').insert({
      tipo: form.tipo,
      status: form.status,
      prioridade: form.prioridade,
      empresa_id: form.empresa_id || null,
      canal_id: form.canal_id || null,
      marketplace_id: form.marketplace_id || null,
      destino_full_id: form.destino_full_id || null,
      loja_destino_id: form.loja_destino_id || null,
      cd_origem_id: form.cd_origem_id || null,
      custo_frete: Number(form.custo_frete || 0),
      outros_custos: Number(form.outros_custos || 0),
      faturamento_estimado: form.faturamento_estimado ? Number(form.faturamento_estimado) : null,
      numero_carga_marketplace: form.numero_carga_marketplace || null,
      codigo_agendamento: form.codigo_agendamento || null,
      solicitante_id: me.id,
      observacoes: form.observacoes || null,
    }).select('*').single();
    if (error) return setError(error.message);
    await supabase.from('load_checklists').insert({ load_id: data.id });
    await supabase.from('load_request_history').insert({ request_id: null, acao: 'CARGA_CRIADA', observacao: data.codigo_interno, autor_profile_id: me.id });
    await loadData();
  }

  async function openLoad(load) {
    setSelected(load);
    const [it, chk] = await Promise.all([
      supabase.from('load_items').select('*').eq('load_id', load.id).order('created_at', { ascending: true }),
      supabase.from('load_checklists').select('*').eq('load_id', load.id).single(),
    ]);
    setItems(it.data ?? []);
    setChecklist(chk.data);
  }

  async function addItem() {
    if (!selected || !canWrite) return;
    const { data: product } = await supabase.from('products').select('id,nome,cmv').eq('sku', newItem.sku).maybeSingle();
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
    };
    const { error } = await supabase.from('load_items').insert(payload);
    if (error) return setError(error.message);
    setNewItem({ sku: '', nome_produto: '', quantidade: 1, cmv_unitario: 0 });
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
        <select className="h-10 border rounded px-2" value={form.tipo} onChange={e=>setForm({...form,tipo:e.target.value})}><option value="LOJA_FISICA">Loja</option><option value="FULL_MARKETPLACE">Full</option></select>
        <input className="h-10 border rounded px-2" placeholder="Empresa ID" onChange={e=>setForm({...form,empresa_id:e.target.value})}/>
        <input className="h-10 border rounded px-2" placeholder="Canal ID" onChange={e=>setForm({...form,canal_id:e.target.value})}/>
        <input className="h-10 border rounded px-2" placeholder="Loja destino ID" onChange={e=>setForm({...form,loja_destino_id:e.target.value})}/>
        <input className="h-10 border rounded px-2" placeholder="Número marketplace" onChange={e=>setForm({...form,numero_carga_marketplace:e.target.value})}/>
        <input className="h-10 border rounded px-2" placeholder="Código agendamento" onChange={e=>setForm({...form,codigo_agendamento:e.target.value})}/>
        <input className="h-10 border rounded px-2" placeholder="Faturamento estimado" type="number" onChange={e=>setForm({...form,faturamento_estimado:e.target.value})}/>
        <input className="h-10 border rounded px-2" placeholder="Custo frete" type="number" onChange={e=>setForm({...form,custo_frete:e.target.value})}/>
      </div>
      {canWrite && <button className="px-3 py-2 bg-indigo-600 text-white rounded" onClick={createLoad}>Criar carga</button>}
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>

    <div className="bg-white border rounded-xl p-4">
      <h2 className="font-semibold mb-2">Lista de cargas</h2>
      <table className="w-full text-sm"><thead><tr className="border-b"><th>Código</th><th>Tipo</th><th>Status</th><th>CMV total</th><th>Ações</th></tr></thead><tbody>
        {loads.map(l => <tr key={l.id} className="border-b"><td>{l.codigo_interno}</td><td>{l.tipo}</td><td>{l.status}</td><td>{Number(l.cmv_total||0).toFixed(2)}</td><td><button className="text-indigo-600" onClick={()=>openLoad(l)}>Detalhe</button></td></tr>)}
      </tbody></table>
    </div>

    {selected && <div className="bg-white border rounded-xl p-4 space-y-4">
      <h3 className="font-semibold">{selected.codigo_interno} • {selected.status}</h3>
      <p className="text-sm text-zinc-600">Aviso: cargas agendadas antes do recebimento e finalização sem NF são permitidas com alerta.</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <input className="h-10 border rounded px-2" placeholder="SKU" value={newItem.sku||''} onChange={e=>setNewItem({...newItem,sku:e.target.value})}/>
        <input className="h-10 border rounded px-2" placeholder="Nome produto" value={newItem.nome_produto||''} onChange={e=>setNewItem({...newItem,nome_produto:e.target.value})}/>
        <input className="h-10 border rounded px-2" placeholder="Quantidade" type="number" value={newItem.quantidade||1} onChange={e=>setNewItem({...newItem,quantidade:e.target.value})}/>
        <input className="h-10 border rounded px-2" placeholder="Fornecedor ID" value={newItem.fornecedor_origem_id||''} onChange={e=>setNewItem({...newItem,fornecedor_origem_id:e.target.value})}/>
        <input className="h-10 border rounded px-2" placeholder="CMV unitário" type="number" value={newItem.cmv_unitario||0} onChange={e=>setNewItem({...newItem,cmv_unitario:e.target.value})}/>
        <input className="h-10 border rounded px-2" placeholder="Altura" type="number" onChange={e=>setNewItem({...newItem,altura:e.target.value})}/>
      </div>
      {Number(newItem.cmv_unitario||0)<=0 && <p className='text-xs text-amber-600'>Produto sem CMV, preencher manualmente.</p>}
      {canWrite && <button className="px-3 py-2 border rounded" onClick={addItem}>Adicionar item</button>}

      <table className="w-full text-sm"><thead><tr className="border-b"><th>SKU</th><th>Nome</th><th>Qtd</th><th>CMV unit</th><th>CMV total</th><th>Cubagem</th></tr></thead><tbody>
        {items.map(i=><tr key={i.id} className="border-b"><td>{i.sku}</td><td>{i.nome_produto}</td><td>{i.quantidade}</td><td>{i.cmv_unitario}</td><td>{i.cmv_total}</td><td>{i.cubagem ?? '-'}</td></tr>)}
      </tbody></table>

      <div className="bg-zinc-50 p-3 rounded text-sm">
        <p>CMV total: {totals.cmv.toFixed(2)}</p>
        <p>Margem estimativa (valor): {totals.margemValor.toFixed(2)}</p>
        <p>Margem estimativa (%): {totals.margemPct === null ? '-' : (totals.margemPct*100).toFixed(2) + '%'}</p>
      </div>

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
