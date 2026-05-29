'use client';

import { useMemo, useState } from 'react';
import type { UserProfile } from '@/lib/auth/roles';

type Load = Record<string, string | number | null | undefined>;

type Props = {
  profile: UserProfile;
  loads: Load[];
  pendingRequests: number;
  metrics?: null | {
    loads_day?: number | null;
    loads_week?: number | null;
    loads_month?: number | null;
    loads_pending?: number | null;
    loads_overdue?: number | null;
    loads_wait_supplier?: number | null;
    loads_wait_receipt?: number | null;
    loads_wait_label?: number | null;
    loads_wait_nf?: number | null;
    loads_ready_pickup?: number | null;
    fin_revenue_month?: number | null;
    fin_cmv_month?: number | null;
    fin_freight_month?: number | null;
    fin_margin_month?: number | null;
  };
};

function countBy(loads: Load[], pred: (l: Load) => boolean) { return loads.filter(pred).length; }

export function DashboardView({ profile, loads, pendingRequests, metrics = null }: Props) {
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [empresaFilter, setEmpresaFilter] = useState('');
  const [canalFilter, setCanalFilter] = useState('');
  const [marketplaceFilter, setMarketplaceFilter] = useState('');
  const [lojaFilter, setLojaFilter] = useState('');
  const [fornecedorFilter, setFornecedorFilter] = useState('');
  const [responsavelFilter, setResponsavelFilter] = useState('');

  const canSeeFinancial = ['admin', 'gerente_estoque', 'financeiro', 'gerente_ecommerce'].includes(profile.perfil);

  const filtered = useMemo(() => loads.filter((l) => {
    if (statusFilter && l.status !== statusFilter) return false;
    if (typeFilter && l.tipo !== typeFilter) return false;
    if (empresaFilter && l.empresa_id !== empresaFilter) return false;
    if (canalFilter && l.canal_id !== canalFilter) return false;
    if (marketplaceFilter && l.marketplace_id !== marketplaceFilter) return false;
    if (lojaFilter && l.loja_destino_id !== lojaFilter) return false;
    if (fornecedorFilter && !String(l.fornecedores ?? '').toLowerCase().includes(fornecedorFilter.toLowerCase())) return false;
    if (responsavelFilter && l.responsavel_operacional_id !== responsavelFilter) return false;
    return true;
  }), [loads, statusFilter, typeFilter, empresaFilter, canalFilter, marketplaceFilter, lojaFilter, fornecedorFilter, responsavelFilter]);

  const cards = useMemo(() => {
    if (metrics) {
      return {
        d: Number(metrics.loads_day ?? 0),
        w: Number(metrics.loads_week ?? 0),
        m: Number(metrics.loads_month ?? 0),
        pend: Number(metrics.loads_pending ?? 0),
        atras: Number(metrics.loads_overdue ?? 0),
        aguForn: Number(metrics.loads_wait_supplier ?? 0),
        aguRec: Number(metrics.loads_wait_receipt ?? 0),
        aguEtiq: Number(metrics.loads_wait_label ?? 0),
        aguNF: Number(metrics.loads_wait_nf ?? 0),
        prontaCol: Number(metrics.loads_ready_pickup ?? 0),
        fat: Number(metrics.fin_revenue_month ?? 0),
        cmv: Number(metrics.fin_cmv_month ?? 0),
        frete: Number(metrics.fin_freight_month ?? 0),
        margem: Number(metrics.fin_margin_month ?? 0),
      };
    }

    const now = new Date();
    const startDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startWeek = new Date(startDay); startWeek.setDate(startDay.getDate() - startDay.getDay());
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const d = countBy(filtered, l => Boolean(l.data_agendada) && new Date(String(l.data_agendada)) >= startDay && new Date(String(l.data_agendada)) < new Date(startDay.getTime()+86400000));
    const w = countBy(filtered, l => Boolean(l.data_agendada) && new Date(String(l.data_agendada)) >= startWeek);
    const m = countBy(filtered, l => Boolean(l.data_agendada) && new Date(String(l.data_agendada)) >= startMonth);
    const pend = countBy(filtered, l => l.status === 'Rascunho' || l.status === 'Aguardando aprovação');
    const atras = countBy(filtered, l => Boolean(l.data_agendada) && new Date(String(l.data_agendada)) < now && !['Finalizada','Entregue','Cancelada'].includes(String(l.status)));
    const aguForn = countBy(filtered, l => l.status === 'Aguardando fornecedor');
    const aguRec = countBy(filtered, l => l.status === 'Aguardando recebimento');
    const aguEtiq = countBy(filtered, l => l.status === 'Etiquetando');
    const aguNF = countBy(filtered, l => l.status === 'Aguardando NF');
    const prontaCol = countBy(filtered, l => l.status === 'Pronta para coleta');

    const fat = filtered.reduce((s, l) => s + Number(l.faturamento_estimado ?? 0), 0);
    const cmv = filtered.reduce((s, l) => s + Number(l.cmv_total ?? 0), 0);
    const frete = filtered.reduce((s, l) => s + Number(l.custo_frete ?? 0), 0);
    const margem = filtered.reduce((s, l) => s + Number(l.margem_estimativa_valor ?? 0), 0);

    return { d,w,m,pend,atras,aguForn,aguRec,aguEtiq,aguNF,prontaCol,fat,cmv,frete,margem };
  }, [filtered, metrics]);

  const alerts = useMemo(() => {
    const now = new Date();
    const oldPendingReq = pendingRequests;
    return {
      hoje: countBy(filtered, l => Boolean(l.data_agendada) && new Date(String(l.data_agendada)).toDateString() === now.toDateString()),
      atrasadas: countBy(filtered, l => Boolean(l.data_agendada) && new Date(String(l.data_agendada)) < now && !['Finalizada','Entregue','Cancelada'].includes(String(l.status))),
      semCmv: countBy(filtered, l => l.cmv_total != null && Number(l.cmv_total) <= 0),
      semReceb: countBy(filtered, l => !l.data_prevista_recebimento),
      aguardFornecedor: countBy(filtered, l => l.status === 'Aguardando fornecedor'),
      aguardNF: countBy(filtered, l => l.status === 'Aguardando NF'),
      aguardEtiqueta: countBy(filtered, l => l.status === 'Etiquetando'),
      produtoNaoReceb: countBy(filtered, l => l.status === 'Aguardando recebimento'),
      reqPendOld: oldPendingReq,
    };
  }, [filtered, pendingRequests]);

  const reportBy = (key: string) => Object.entries(filtered.reduce<Record<string, number>>((acc, l) => { const k = String(l[key] ?? 'N/A'); acc[k] = (acc[k] ?? 0) + 1; return acc; }, {}));
  const reportMonth = Object.entries(filtered.reduce<Record<string, number>>((acc, l) => { const k = l.created_at ? new Date(String(l.created_at)).toISOString().slice(0, 7) : 'N/A'; acc[k] = (acc[k] ?? 0) + 1; return acc; }, {}));

  return <div className="space-y-6">
    <div className="flex flex-wrap gap-2">
      <select className="h-9 border rounded px-2" value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}><option value="">Tipo</option><option value="FULL_MARKETPLACE">Full</option><option value="LOJA_FISICA">Loja</option></select>
      <input className="h-9 border rounded px-2" placeholder="Status" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} />
      <input className="h-9 border rounded px-2" placeholder="Empresa" value={empresaFilter} onChange={e=>setEmpresaFilter(e.target.value)} />
      <input className="h-9 border rounded px-2" placeholder="Canal" value={canalFilter} onChange={e=>setCanalFilter(e.target.value)} />
      <input className="h-9 border rounded px-2" placeholder="Marketplace" value={marketplaceFilter} onChange={e=>setMarketplaceFilter(e.target.value)} />
      <input className="h-9 border rounded px-2" placeholder="Loja" value={lojaFilter} onChange={e=>setLojaFilter(e.target.value)} />
      <input className="h-9 border rounded px-2" placeholder="Fornecedor" value={fornecedorFilter} onChange={e=>setFornecedorFilter(e.target.value)} />
      <input className="h-9 border rounded px-2" placeholder="Responsável" value={responsavelFilter} onChange={e=>setResponsavelFilter(e.target.value)} />
    </div>

    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
      {[
        ['Cargas do dia', cards.d],['Cargas da semana', cards.w],['Cargas do mês', cards.m],['Cargas pendentes', cards.pend],
        ['Solicitações pendentes', pendingRequests],['Cargas atrasadas', cards.atras],['Aguardando fornecedor', cards.aguForn],['Aguardando recebimento', cards.aguRec],
        ['Aguardando etiqueta', cards.aguEtiq],['Aguardando NF', cards.aguNF],['Prontas coleta', cards.prontaCol],
      ].map(([k,v])=> <div key={String(k)} className="bg-white border rounded p-3"><div className="text-zinc-500">{k}</div><div className="text-xl font-bold">{String(v)}</div></div>)}
      {canSeeFinancial && <>
        <div className="bg-white border rounded p-3"><div className="text-zinc-500">Faturamento estimado</div><div className="text-xl font-bold">R$ {cards.fat.toFixed(2)}</div></div>
        <div className="bg-white border rounded p-3"><div className="text-zinc-500">CMV total</div><div className="text-xl font-bold">R$ {cards.cmv.toFixed(2)}</div></div>
        <div className="bg-white border rounded p-3"><div className="text-zinc-500">Frete total</div><div className="text-xl font-bold">R$ {cards.frete.toFixed(2)}</div></div>
        <div className="bg-white border rounded p-3"><div className="text-zinc-500">Margem estimada</div><div className="text-xl font-bold">R$ {cards.margem.toFixed(2)}</div></div>
      </>}
    </div>

    <div className="bg-white border rounded p-4 text-sm">
      <h2 className="font-semibold mb-2">Alertas</h2>
      <div className="grid md:grid-cols-3 gap-2 text-amber-700">
        <div>Cargas hoje: {alerts.hoje}</div><div>Cargas atrasadas: {alerts.atrasadas}</div><div>Cargas sem CMV: {alerts.semCmv}</div>
        <div>Sem data recebimento: {alerts.semReceb}</div><div>Aguardando fornecedor: {alerts.aguardFornecedor}</div><div>Aguardando NF: {alerts.aguardNF}</div>
        <div>Aguardando etiqueta: {alerts.aguardEtiqueta}</div><div>Produto não recebido: {alerts.produtoNaoReceb}</div><div>Solicitações pendentes {'>'} X dias: {alerts.reqPendOld}</div>
      </div>
    </div>

    <div className="grid md:grid-cols-2 gap-4 text-sm">
      <div className="bg-white border rounded p-4"><h3 className="font-semibold mb-2">Relatório: cargas por mês</h3>{reportMonth.map(([k,v])=><div key={k}>{k}: {String(v)}</div>)}</div>
      <div className="bg-white border rounded p-4"><h3 className="font-semibold mb-2">Cargas por empresa</h3>{reportBy('empresa_id').map(([k,v])=><div key={k}>{k}: {String(v)}</div>)}</div>
      <div className="bg-white border rounded p-4"><h3 className="font-semibold mb-2">Cargas por marketplace</h3>{reportBy('marketplace_id').map(([k,v])=><div key={k}>{k}: {String(v)}</div>)}</div>
      <div className="bg-white border rounded p-4"><h3 className="font-semibold mb-2">Cargas por loja</h3>{reportBy('loja_destino_id').map(([k,v])=><div key={k}>{k}: {String(v)}</div>)}</div>
      <div className="bg-white border rounded p-4"><h3 className="font-semibold mb-2">Cargas por fornecedor</h3>{reportBy('fornecedores').map(([k,v])=><div key={k}>{k}: {String(v)}</div>)}</div>
      <div className="bg-white border rounded p-4"><h3 className="font-semibold mb-2">Cargas por status</h3>{reportBy('status').map(([k,v])=><div key={k}>{k}: {String(v)}</div>)}</div>
    </div>
  </div>;
}
