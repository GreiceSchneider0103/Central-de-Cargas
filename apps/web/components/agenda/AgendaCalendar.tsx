'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { UserProfile } from '@/lib/auth/roles';

type LoadRow = {
  id: string;
  codigo_interno: string;
  numero_carga_marketplace: string | null;
  codigo_agendamento: string | null;
  tipo: string;
  status: string;
  data_agendada: string | null;
  data_prevista_recebimento: string | null;
  data_real_recebimento: string | null;
  cmv_total: number;
  loja_destino_id: string | null;
  marketplace_id: string | null;
  empresa_id: string | null;
  responsavel_operacional_id: string | null;
  canal_nome?: string | null;
  loja_nome?: string | null;
  responsavel_nome?: string | null;
  fornecedores?: string;
  comentario?: string;
};

function monthMatrix(year: number, month: number) {
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

export function AgendaCalendar({ loads, profile }: { loads: LoadRow[]; profile: UserProfile }) {
  const supabase = createClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [fType, setFType] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fEmpresa, setFEmpresa] = useState('');
  const [fMarketplace, setFMarketplace] = useState('');
  const [fLoja, setFLoja] = useState('');
  const [fFornecedor, setFFornecedor] = useState('');
  const [fResponsavel, setFResponsavel] = useState('');

  const canEditDate = profile.perfil === 'admin' || profile.perfil === 'gerente_estoque' || profile.perfil === 'gerente_ecommerce';

  const days = useMemo(() => monthMatrix(year, month), [year, month]);

  const filtered = useMemo(() => loads.filter((l) => {
    if (fType && l.tipo !== fType) return false;
    if (fStatus && l.status !== fStatus) return false;
    if (fEmpresa && l.empresa_id !== fEmpresa) return false;
    if (fMarketplace && l.marketplace_id !== fMarketplace) return false;
    if (fLoja && l.loja_destino_id !== fLoja) return false;
    if (fFornecedor && !(l.fornecedores || '').toLowerCase().includes(fFornecedor.toLowerCase())) return false;
    if (fResponsavel && l.responsavel_operacional_id !== fResponsavel) return false;
    return true;
  }), [loads, fType, fStatus, fEmpresa, fMarketplace, fLoja, fFornecedor, fResponsavel]);

  const byDay = useMemo(() => {
    const m = new Map<string, LoadRow[]>();
    for (const l of filtered) {
      if (!l.data_agendada) continue;
      const k = new Date(l.data_agendada).toISOString().slice(0, 10);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(l);
    }
    return m;
  }, [filtered]);

  async function editDate(load: LoadRow) {
    if (!canEditDate) return;
    if (profile.perfil === 'gerente_ecommerce' && load.tipo !== 'FULL_MARKETPLACE') return;
    const next = prompt('Nova data agendada (YYYY-MM-DD HH:mm)', load.data_agendada ? new Date(load.data_agendada).toISOString().slice(0, 16).replace('T', ' ') : '');
    if (!next) return;
    const res = await fetch(`/api/loads/${load.id}/schedule`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dataAgendada: next }) });
    if (!res.ok) return;
    window.location.reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <button className="px-3 py-1 border rounded" onClick={() => setMonth((m) => (m === 0 ? 11 : m - 1))}>◀</button>
        <strong>{new Date(year, month, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</strong>
        <button className="px-3 py-1 border rounded" onClick={() => setMonth((m) => (m === 11 ? 0 : m + 1))}>▶</button>
        <select className="h-9 border rounded px-2" value={fType} onChange={(e) => setFType(e.target.value)}><option value="">Tipo</option><option value="FULL_MARKETPLACE">Full</option><option value="LOJA_FISICA">Loja</option></select>
        <input className="h-9 border rounded px-2" placeholder="Status" value={fStatus} onChange={(e) => setFStatus(e.target.value)} />
        <input className="h-9 border rounded px-2" placeholder="Empresa ID" value={fEmpresa} onChange={(e) => setFEmpresa(e.target.value)} />
        <input className="h-9 border rounded px-2" placeholder="Marketplace ID" value={fMarketplace} onChange={(e) => setFMarketplace(e.target.value)} />
        <input className="h-9 border rounded px-2" placeholder="Loja ID" value={fLoja} onChange={(e) => setFLoja(e.target.value)} />
        <input className="h-9 border rounded px-2" placeholder="Fornecedor" value={fFornecedor} onChange={(e) => setFFornecedor(e.target.value)} />
        <input className="h-9 border rounded px-2" placeholder="Responsável ID" value={fResponsavel} onChange={(e) => setFResponsavel(e.target.value)} />
      </div>

      <div className="grid grid-cols-7 gap-2 text-xs font-semibold text-zinc-500">
        {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map((d) => <div key={d}>{d}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map((d) => {
          const key = d.toISOString().slice(0, 10);
          const events = byDay.get(key) || [];
          return (
            <div key={key} className={`min-h-[150px] border rounded p-2 ${d.getMonth() !== month ? 'bg-zinc-50' : 'bg-white'}`}>
              <div className="text-xs mb-1">{d.getDate()}</div>
              <div className="space-y-1">
                {events.map((e) => {
                  const ag = e.data_agendada ? new Date(e.data_agendada) : null;
                  const atraso = ag && ag < new Date() && !['Finalizada', 'Cancelada', 'Entregue'].includes(e.status);
                  const semCMV = Number(e.cmv_total || 0) <= 0;
                  const semPrev = !e.data_prevista_recebimento;
                  const agAntesRec = !!(e.data_agendada && e.data_prevista_recebimento && new Date(e.data_agendada) < new Date(e.data_prevista_recebimento));
                  const aguardNF = e.status === 'Aguardando NF';
                  const aguardEtiqueta = e.status === 'Etiquetando';
                  return <div key={e.id} className="border rounded p-1 text-[10px] bg-zinc-50">
                    <div className="font-semibold">{e.codigo_interno}</div>
                    <div>{e.numero_carga_marketplace || '-'} | {e.codigo_agendamento || '-'}</div>
                    <div>{e.tipo} • {e.canal_nome || e.loja_nome || '-'}</div>
                    <div>{ag ? ag.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--'} • {e.status}</div>
                    <div>Fornec.: {e.fornecedores || '-'}</div>
                    <div>Resp.: {e.responsavel_nome || '-'}</div>
                    <div>Coment.: {e.comentario || '-'}</div>
                    <div className="text-amber-600">
                      {atraso && 'Atrasada '} {semCMV && 'Sem CMV '} {semPrev && 'Sem previsão '} {agAntesRec && 'Agendada antes receb. '} {aguardNF && 'Aguard NF '} {aguardEtiqueta && 'Aguard etiqueta'}
                    </div>
                    <div className="flex gap-2 mt-1">
                      <Link className="text-indigo-600" href={`/cargas/${e.id}`}>Detalhe</Link>
                      {canEditDate && <button className="text-emerald-700" onClick={() => editDate(e)}>Alterar data</button>}
                    </div>
                  </div>;
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
