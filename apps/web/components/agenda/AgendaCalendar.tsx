'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { UserProfile } from '@/lib/auth/roles';

type SelectOption = { id: string; nome: string };
export type AgendaOptions = {
  companies: SelectOption[];
  channels: SelectOption[];
  stores: SelectOption[];
  fullDestinations: SelectOption[];
  suppliers: SelectOption[];
};

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
  destino_full_id?: string | null;
  empresa_id: string | null;
  responsavel_operacional_id: string | null;
  canal_nome?: string | null;
  loja_nome?: string | null;
  responsavel_nome?: string | null;
  fornecedores?: string;
  comentario?: string;
  alerts?: { alert_type: string; message: string | null }[];
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

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function localDateKey(value: Date) {
  return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
}

function localDateKeyFromIso(value: string) {
  return localDateKey(new Date(value));
}

function localTimeKeyFromIso(value: string) {
  const d = new Date(value);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function alertLabel(alertType: string) {
  switch (alertType) {
    case 'FULL_SEM_NUMERO_MARKETPLACE':
      return 'Full sem nº marketplace';
    case 'FULL_SEM_CODIGO_AGENDAMENTO':
      return 'Full sem agendamento';
    case 'FINALIZADA_SEM_NF':
      return 'Finalizada sem NF';
    case 'PRODUTO_SEM_CMV':
      return 'Sem CMV';
    case 'SEM_FATURAMENTO_ESTIMADO':
      return 'Sem faturamento';
    case 'AGENDADA_ANTES_RECEBIMENTO':
      return 'Agendada antes receb.';
    default:
      return alertType;
  }
}

export function AgendaCalendar({
  loads,
  profile,
  options,
}: {
  loads: LoadRow[];
  profile: UserProfile;
  options: AgendaOptions;
}) {
  const now = new Date();
  const [year] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [fType, setFType] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fEmpresa, setFEmpresa] = useState('');
  const [fMarketplace, setFMarketplace] = useState('');
  const [fLoja, setFLoja] = useState('');
  const [fFornecedor, setFFornecedor] = useState('');
  const [fResponsavel, setFResponsavel] = useState('');

  const canEditDate =
    profile.perfil === 'admin' ||
    profile.perfil === 'gerente_estoque' ||
    profile.perfil === 'gerente_ecommerce';

  const days = useMemo(() => monthMatrix(year, month), [year, month]);
  const [monthLoads, setMonthLoads] = useState<LoadRow[]>(loads ?? []);

  const companyById = useMemo(
    () => new Map(options.companies.map((c) => [c.id, c.nome])),
    [options.companies],
  );
  const channelById = useMemo(
    () => new Map(options.channels.map((c) => [c.id, c.nome])),
    [options.channels],
  );
  const storeById = useMemo(
    () => new Map(options.stores.map((s) => [s.id, s.nome])),
    [options.stores],
  );
  const destinationById = useMemo(
    () => new Map(options.fullDestinations.map((d) => [d.id, d.nome])),
    [options.fullDestinations],
  );

  useEffect(() => {
    async function fetchMonthLoads() {
      const from = days[0];
      const to = new Date(days[days.length - 1]);
      to.setDate(to.getDate() + 1);

      const res = await fetch('/api/loads/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: from.toISOString(), to: to.toISOString() }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data?.loads)) setMonthLoads(data.loads as LoadRow[]);
    }

    fetchMonthLoads();
  }, [days]);

  const filtered = useMemo(
    () =>
      monthLoads.filter((l) => {
        if (fType && l.tipo !== fType) return false;
        if (fStatus && l.status !== fStatus) return false;
        if (fEmpresa && l.empresa_id !== fEmpresa) return false;
        if (fMarketplace && l.marketplace_id !== fMarketplace) return false;
        if (fLoja && l.loja_destino_id !== fLoja) return false;
        if (
          fFornecedor &&
          !(l.fornecedores || '').toLowerCase().includes(fFornecedor.toLowerCase())
        )
          return false;
        if (fResponsavel && l.responsavel_operacional_id !== fResponsavel) return false;
        return true;
      }),
    [
      monthLoads,
      fType,
      fStatus,
      fEmpresa,
      fMarketplace,
      fLoja,
      fFornecedor,
      fResponsavel,
    ],
  );

  const byDay = useMemo(() => {
    const m = new Map<string, LoadRow[]>();
    for (const l of filtered) {
      if (!l.data_agendada) continue;
      const k = localDateKeyFromIso(l.data_agendada);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(l);
    }
    return m;
  }, [filtered]);

  const statusOptions = useMemo(
    () =>
      Array.from(new Set(monthLoads.map((l) => l.status).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b),
      ),
    [monthLoads],
  );

  const responsavelOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const l of monthLoads) {
      if (!l.responsavel_operacional_id) continue;
      if (!byId.has(l.responsavel_operacional_id)) {
        byId.set(
          l.responsavel_operacional_id,
          l.responsavel_nome || l.responsavel_operacional_id,
        );
      }
    }
    return Array.from(byId.entries())
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [monthLoads]);

  const supplierTextOptions = useMemo(() => {
    const values = Array.from(
      new Set(
        (monthLoads ?? []).flatMap((l) =>
          (l.fornecedores || '')
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean),
        ),
      ),
    );
    values.sort((a, b) => a.localeCompare(b));
    return values;
  }, [monthLoads]);

  const conflictByLoadId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of filtered) {
      if (!l.data_agendada) continue;
      const dayKey = localDateKeyFromIso(l.data_agendada);
      const timeKey = localTimeKeyFromIso(l.data_agendada);
      const destKey = l.destino_full_id || l.loja_destino_id || l.marketplace_id || 'unknown';
      const k = `${dayKey}|${timeKey}|${destKey}`;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }

    const byLoad = new Map<string, boolean>();
    for (const l of filtered) {
      if (!l.data_agendada) continue;
      const dayKey = localDateKeyFromIso(l.data_agendada);
      const timeKey = localTimeKeyFromIso(l.data_agendada);
      const destKey = l.destino_full_id || l.loja_destino_id || l.marketplace_id || 'unknown';
      const k = `${dayKey}|${timeKey}|${destKey}`;
      byLoad.set(l.id, (counts.get(k) ?? 0) > 1);
    }
    return byLoad;
  }, [filtered]);

  async function editDate(load: LoadRow) {
    if (!canEditDate) return;
    if (profile.perfil === 'gerente_ecommerce' && load.tipo !== 'FULL_MARKETPLACE')
      return;
    const next = prompt(
      'Nova data agendada (YYYY-MM-DD HH:mm)',
      load.data_agendada
        ? new Date(load.data_agendada)
            .toISOString()
            .slice(0, 16)
            .replace('T', ' ')
        : '',
    );
    if (!next) return;
    const res = await fetch(`/api/loads/${load.id}/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataAgendada: next }),
    });
    if (!res.ok) return;
    window.location.reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <button
          className="px-3 py-1 border rounded"
          onClick={() => setMonth((m) => (m === 0 ? 11 : m - 1))}
        >
          &lt;
        </button>
        <strong>
          {new Date(year, month, 1).toLocaleDateString('pt-BR', {
            month: 'long',
            year: 'numeric',
          })}
        </strong>
        <button
          className="px-3 py-1 border rounded"
          onClick={() => setMonth((m) => (m === 11 ? 0 : m + 1))}
        >
          &gt;
        </button>

        <select
          className="h-9 border rounded px-2"
          value={fType}
          onChange={(e) => setFType(e.target.value)}
        >
          <option value="">Tipo</option>
          <option value="FULL_MARKETPLACE">Full</option>
          <option value="LOJA_FISICA">Loja</option>
        </select>

        <select
          className="h-9 border rounded px-2"
          value={fStatus}
          onChange={(e) => setFStatus(e.target.value)}
        >
          <option value="">Status</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          className="h-9 border rounded px-2"
          value={fEmpresa}
          onChange={(e) => setFEmpresa(e.target.value)}
        >
          <option value="">Empresa</option>
          {options.companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>

        <select
          className="h-9 border rounded px-2"
          value={fMarketplace}
          onChange={(e) => setFMarketplace(e.target.value)}
        >
          <option value="">Marketplace</option>
          {options.channels.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>

        <select
          className="h-9 border rounded px-2"
          value={fLoja}
          onChange={(e) => setFLoja(e.target.value)}
        >
          <option value="">Loja</option>
          {options.stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nome}
            </option>
          ))}
        </select>

        <select
          className="h-9 border rounded px-2"
          value={fFornecedor}
          onChange={(e) => setFFornecedor(e.target.value)}
        >
          <option value="">Fornecedor</option>
          {supplierTextOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
          {supplierTextOptions.length === 0 &&
            options.suppliers.map((s) => (
              <option key={s.id} value={s.nome}>
                {s.nome}
              </option>
            ))}
        </select>

        <select
          className="h-9 border rounded px-2"
          value={fResponsavel}
          onChange={(e) => setFResponsavel(e.target.value)}
        >
          <option value="">Responsável</option>
          {responsavelOptions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nome}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-7 gap-2 text-xs font-semibold text-zinc-500">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map((d) => {
          const key = localDateKey(d);
          const events = byDay.get(key) || [];
          const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9, 0, 0);
          const createHref = `/cargas?data_agendada=${encodeURIComponent(startOfDay.toISOString())}`;

          return (
            <div
              key={key}
              className={`min-h-[150px] border rounded p-2 ${
                d.getMonth() !== month ? 'bg-zinc-50' : 'bg-white'
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-1">
                <span>{d.getDate()}</span>
                <Link
                  className="text-indigo-600"
                  href={createHref}
                  title="Criar carga com data agendada"
                >
                  +
                </Link>
              </div>

              <div className="space-y-1">
                {events.map((e) => {
                  const ag = e.data_agendada ? new Date(e.data_agendada) : null;
                  const atraso =
                    ag &&
                    ag < new Date() &&
                    !['Finalizada', 'Cancelada', 'Entregue'].includes(e.status);
                  const derivedSemPrev = !e.data_prevista_recebimento;
                  const derivedAguardNF = e.status === 'Aguardando NF';
                  const derivedAguardEtiqueta = e.status === 'Etiquetando';
                  const conflict = conflictByLoadId.get(e.id) ?? false;
                  const activeAlertTypes = (e.alerts ?? []).map((a) => a.alert_type);

                  const empresaNome = e.empresa_id
                    ? companyById.get(e.empresa_id) ?? e.empresa_id
                    : '-';
                  const marketplaceNome = e.marketplace_id
                    ? channelById.get(e.marketplace_id) ?? e.marketplace_id
                    : null;
                  const destinoNome = e.destino_full_id
                    ? destinationById.get(e.destino_full_id) ?? e.destino_full_id
                    : null;
                  const lojaNome = e.loja_destino_id
                    ? storeById.get(e.loja_destino_id) ?? e.loja_nome ?? e.loja_destino_id
                    : e.loja_nome ?? null;
                  const destinoDisplay =
                    e.tipo === 'FULL_MARKETPLACE'
                      ? destinoNome || marketplaceNome || '-'
                      : lojaNome || '-';

                  return (
                    <div key={e.id} className="border rounded p-1 text-[10px] bg-zinc-50">
                      <div className="font-semibold">{e.codigo_interno}</div>
                      <div>
                        {e.numero_carga_marketplace || '-'} | {e.codigo_agendamento || '-'}
                      </div>
                      <div>
                        {e.tipo} • {e.canal_nome || '-'} • {destinoDisplay}
                      </div>
                      <div>
                        {ag
                          ? ag.toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '--:--'}{' '}
                        • {e.status}
                      </div>
                      <div>Empresa: {empresaNome}</div>
                      <div>Fornec.: {e.fornecedores || '-'}</div>
                      <div>Resp.: {e.responsavel_nome || '-'}</div>
                      <div>Coment.: {e.comentario || '-'}</div>

                      <div className="flex flex-wrap gap-1 mt-1">
                        {conflict && (
                          <span className="px-1 rounded bg-rose-100 text-rose-700">
                            CONFLITO
                          </span>
                        )}
                        {atraso && (
                          <span className="px-1 rounded bg-amber-100 text-amber-700">
                            Atrasada
                          </span>
                        )}
                        {derivedSemPrev && (
                          <span className="px-1 rounded bg-amber-100 text-amber-700">
                            Sem previsão
                          </span>
                        )}
                        {derivedAguardNF && (
                          <span className="px-1 rounded bg-amber-100 text-amber-700">
                            Aguard. NF
                          </span>
                        )}
                        {derivedAguardEtiqueta && (
                          <span className="px-1 rounded bg-amber-100 text-amber-700">
                            Aguard. etiqueta
                          </span>
                        )}
                        {activeAlertTypes.map((t) => (
                          <span
                            key={t}
                            className="px-1 rounded bg-amber-100 text-amber-700"
                          >
                            {alertLabel(t)}
                          </span>
                        ))}
                      </div>

                      <div className="flex gap-2 mt-1">
                        <Link className="text-indigo-600" href={`/cargas/${e.id}`}>
                          Detalhe
                        </Link>
                        {canEditDate && (
                          <button className="text-emerald-700" onClick={() => editDate(e)}>
                            Alterar data
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

