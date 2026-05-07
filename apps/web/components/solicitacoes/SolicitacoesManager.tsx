'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { UserProfile } from '@/lib/auth/roles';

type Item = { sku: string; nome_produto: string; quantidade: number; fornecedor_origem_id?: string; cmv_unitario: number; cmv_total: number };

export function SolicitacoesManager({ profile }: { profile: UserProfile }) {
  const supabase = createClient();
  const [rows, setRows] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [destinations, setDestinations] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [items, setItems] = useState<Item[]>([{ sku: '', nome_produto: '', quantidade: 1, cmv_unitario: 0, cmv_total: 0 }]);
  const [tipo, setTipo] = useState<'LOJA_FISICA' | 'FULL_MARKETPLACE'>('LOJA_FISICA');
  const [lojaDestinoId, setLojaDestinoId] = useState('');
  const [marketplaceId, setMarketplaceId] = useState('');
  const [destinoFullId, setDestinoFullId] = useState('');
  const [empresaId, setEmpresaId] = useState('');
  const [canalId, setCanalId] = useState('');
  const [prioridade, setPrioridade] = useState('Média');
  const [observacoes, setObservacoes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const canApprove = profile.perfil === 'admin' || profile.perfil === 'gerente_estoque';

  async function load() {
    const [reqs, c, s, ch, d, sup] = await Promise.all([
      supabase.from('load_requests').select('id,codigo,tipo,status,created_at,carga_id').order('created_at', { ascending: false }),
      supabase.from('companies').select('id,nome').eq('ativo', true),
      supabase.from('stores').select('id,nome').eq('ativo', true),
      supabase.from('channels').select('id,nome,tipo').eq('ativo', true),
      supabase.from('full_destinations').select('id,nome').eq('ativo', true),
      supabase.from('suppliers').select('id,nome').eq('ativo', true),
    ]);
    setRows(reqs.data ?? []);
    setCompanies(c.data ?? []); setStores(s.data ?? []); setChannels(ch.data ?? []); setDestinations(d.data ?? []); setSuppliers(sup.data ?? []);
  }

  useEffect(() => { load(); }, []);

  function updateItem(index: number, field: keyof Item, value: any) {
    const next = [...items];
    (next[index] as any)[field] = value;
    next[index].cmv_total = Number(next[index].quantidade) * Number(next[index].cmv_unitario || 0);
    setItems(next);
  }

  async function handleSkuChange(index: number, sku: string) {
    const next = [...items];
    next[index].sku = sku;
    const { data: product } = await supabase.from('products').select('id,nome,cmv').eq('sku', sku).maybeSingle();
    if (product) {
      next[index].nome_produto = product.nome;
      next[index].cmv_unitario = Number(product.cmv || 0);
      next[index].cmv_total = next[index].cmv_unitario * next[index].quantidade;
    }
    setItems(next);
  }

  async function createRequest() {
    setError(null);
    if (profile.perfil === 'gerente_ecommerce' && tipo !== 'FULL_MARKETPLACE') return setError('Gerente e-commerce cria apenas Full.');
    if (profile.perfil === 'vendedor_loja' && tipo !== 'LOJA_FISICA') return setError('Vendedor cria apenas Loja Física.');
    if (tipo === 'LOJA_FISICA' && !lojaDestinoId) return setError('Solicitação de loja física exige loja destino.');
    if (tipo === 'FULL_MARKETPLACE' && (!destinoFullId || (!marketplaceId && !canalId))) return setError('Solicitação Full exige destino e marketplace/canal.');
    if (items.some((i) => !i.sku || !i.nome_produto || i.quantidade <= 0)) return setError('Cada item precisa SKU, nome e quantidade.');

    const authUser = (await supabase.auth.getUser()).data.user;
    const { data: me } = await supabase.from('users_profile').select('id').eq('auth_user_id', authUser?.id!).single();
    const code = `REQ-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const { data: req, error } = await supabase.from('load_requests').insert({ codigo: code, tipo, empresa_id: empresaId || null, canal_id: canalId || null, marketplace_id: marketplaceId || null, destino_full_id: destinoFullId || null, loja_destino_id: lojaDestinoId || null, prioridade, status: 'Pendente', solicitante_id: me.id, observacoes }).select('id').single();
    if (error) return setError(error.message);

    const { error: itemErr } = await supabase.from('load_request_items').insert(items.map((i) => ({ ...i, request_id: req.id })));
    if (itemErr) return setError(itemErr.message);

    await supabase.from('load_request_history').insert({ request_id: req.id, acao: 'CRIADA', status_novo: 'Pendente', autor_profile_id: me.id });
    setItems([{ sku: '', nome_produto: '', quantidade: 1, cmv_unitario: 0, cmv_total: 0 }]);
    await load();
  }

  async function changeStatus(id: string, status: string, motivo?: string) {
    if (!canApprove) return;
    const url = status === 'Aprovada' ? `/api/load-requests/${id}/approve` : status === 'Recusada' ? `/api/load-requests/${id}/reject` : `/api/load-requests/${id}/request-adjust`;
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ motivo }) });
    if (!res.ok) { const j = await res.json(); setError(j.error || 'Erro'); return; }
    await load();
  }


  async function convertToLoad(id: string) {
    if (!confirm('Deseja transformar esta solicitação em carga oficial?')) return;
    const res = await fetch(`/api/load-requests/${id}/convert`, { method: 'POST' });
    const j = await res.json();
    if (!res.ok) { setError(j.error || 'Erro na conversão'); return; }
    alert(`Carga criada com sucesso: ${j.loadId}`);
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded-xl p-4 space-y-3">
        <h2 className="font-semibold">Nova solicitação</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <select value={tipo} onChange={(e) => setTipo(e.target.value as any)} className="h-10 border rounded px-2"><option value="LOJA_FISICA">Loja física</option><option value="FULL_MARKETPLACE">Full Marketplace</option></select>
          <select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} className="h-10 border rounded px-2"><option value="">Empresa</option>{companies.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select>
          <select value={canalId} onChange={(e) => setCanalId(e.target.value)} className="h-10 border rounded px-2"><option value="">Canal</option>{channels.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select>
          <select value={marketplaceId} onChange={(e) => setMarketplaceId(e.target.value)} className="h-10 border rounded px-2"><option value="">Marketplace</option>{channels.filter(c=>c.tipo==='Marketplace Full').map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select>
          <select value={destinoFullId} onChange={(e) => setDestinoFullId(e.target.value)} className="h-10 border rounded px-2"><option value="">Destino Full</option>{destinations.map(d=><option key={d.id} value={d.id}>{d.nome}</option>)}</select>
          <select value={lojaDestinoId} onChange={(e) => setLojaDestinoId(e.target.value)} className="h-10 border rounded px-2"><option value="">Loja destino</option>{stores.map(s=><option key={s.id} value={s.id}>{s.nome}</option>)}</select>
        </div>
        {items.map((item, idx) => (
          <div key={idx} className="grid grid-cols-1 md:grid-cols-6 gap-2">
            <input placeholder="SKU" className="h-10 border rounded px-2" value={item.sku} onChange={(e) => handleSkuChange(idx, e.target.value)} />
            <input placeholder="Nome" className="h-10 border rounded px-2" value={item.nome_produto} onChange={(e) => updateItem(idx, 'nome_produto', e.target.value)} />
            <input placeholder="Quantidade" type="number" className="h-10 border rounded px-2" value={item.quantidade} onChange={(e) => updateItem(idx, 'quantidade', Number(e.target.value))} />
            <select className="h-10 border rounded px-2" value={item.fornecedor_origem_id || ''} onChange={(e) => updateItem(idx, 'fornecedor_origem_id', e.target.value)}><option value="">Fornecedor</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.nome}</option>)}</select>
            <input placeholder="CMV unitário" type="number" className="h-10 border rounded px-2" value={item.cmv_unitario} onChange={(e) => updateItem(idx, 'cmv_unitario', Number(e.target.value))} />
            <div className="h-10 border rounded px-2 flex items-center">CMV total: {item.cmv_total.toFixed(2)}</div>
            {Number(item.cmv_unitario) <= 0 && <p className="text-xs text-amber-600 col-span-6">Produto sem CMV cadastrado. Informe manualmente.</p>}
          </div>
        ))}
        <div className="flex gap-2">
          <button className="px-3 py-2 border rounded" onClick={() => setItems((prev) => [...prev, { sku: '', nome_produto: '', quantidade: 1, cmv_unitario: 0, cmv_total: 0 }])}>+ Item</button>
          <button className="px-3 py-2 bg-indigo-600 text-white rounded" onClick={createRequest}>Criar solicitação</button>
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </div>

      <div className="bg-white border rounded-xl p-4">
        <h2 className="font-semibold mb-3">Lista de solicitações</h2>
        <table className="w-full text-sm">
          <thead><tr className="border-b"><th>Código</th><th>Tipo</th><th>Status</th><th>Criada em</th><th>Ações</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b">
                <td><Link className="text-indigo-600" href={`/solicitacoes/${r.id}`}>{r.codigo}</Link></td><td>{r.tipo}</td><td>{r.status}</td><td>{new Date(r.created_at).toLocaleString('pt-BR')}</td>
                <td className="space-x-2">
                  {canApprove && <button className="text-emerald-700" onClick={() => changeStatus(r.id, 'Aprovada')}>Aprovar</button>}
                  {canApprove && <button className="text-rose-700" onClick={() => { const m=prompt('Motivo da recusa'); if(m) changeStatus(r.id, 'Recusada', m); }}>Recusar</button>}
                  {canApprove && <button className="text-amber-700" onClick={() => { const m=prompt('Solicitar ajuste:'); if(m) changeStatus(r.id, 'Ajuste solicitado', m); }}>Solicitar ajuste</button>}
                  {canApprove && r.status === 'Aprovada' && !(r as any).carga_id && <button className="text-indigo-700" onClick={() => convertToLoad(r.id)}>Transformar em carga</button>}
                  {(r as any).carga_id && <a className="text-indigo-700" href={`/cargas/${(r as any).carga_id}`}>Abrir carga</a>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
