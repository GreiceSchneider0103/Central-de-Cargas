'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { UserProfile } from '@/lib/auth/roles';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { cn } from '@/lib/utils';
import { MonthView } from './MonthView';
import { WeekView } from './WeekView';
import { DayView } from './DayView';
import { EventDetailDialog } from './EventDetailDialog';
import {
  addDays,
  startOfWeek,
  EMPTY_FILTERS,
  type AgendaFilters,
  type AgendaLoad,
  type AgendaOptions,
} from './types';

type ViewMode = 'month' | 'week' | 'day';

export function AgendaCalendar({
  loads: initialLoads,
  profile,
  options,
}: {
  loads: AgendaLoad[];
  profile: UserProfile;
  options: AgendaOptions;
}) {
  const [view, setView] = useState<ViewMode>('month');
  const [cursor, setCursor] = useState(() => new Date());
  const [loads, setLoads] = useState<AgendaLoad[]>(initialLoads ?? []);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<AgendaFilters>(EMPTY_FILTERS);
  const [selectedLoad, setSelectedLoad] = useState<AgendaLoad | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canEditDate = ['admin', 'gerente_estoque', 'gerente_ecommerce'].includes(profile.perfil);

  const range = useMemo(() => {
    if (view === 'month') {
      const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const from = startOfWeek(first);
      const to = addDays(from, 42);
      return { from, to };
    }
    if (view === 'week') {
      const from = startOfWeek(cursor);
      return { from, to: addDays(from, 7) };
    }
    const from = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
    return { from, to: addDays(from, 1) };
  }, [view, cursor]);

  const fetchLoads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/loads/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: range.from.toISOString(), to: range.to.toISOString() }),
      });
      if (!res.ok) {
        setError('Não foi possível carregar a agenda.');
        return;
      }
      const data = await res.json();
      if (Array.isArray(data?.loads)) setLoads(data.loads as AgendaLoad[]);
    } catch {
      setError('Não foi possível carregar a agenda.');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchLoads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from.getTime(), range.to.getTime()]);

  const companyById = useMemo(() => new Map(options.companies.map((c) => [c.id, c.nome])), [options.companies]);
  const channelById = useMemo(() => new Map(options.channels.map((c) => [c.id, c.nome])), [options.channels]);
  const storeById = useMemo(() => new Map(options.stores.map((s) => [s.id, s.nome])), [options.stores]);
  const destinationById = useMemo(() => new Map(options.fullDestinations.map((d) => [d.id, d.nome])), [options.fullDestinations]);

  function destinoDisplay(load: AgendaLoad) {
    if (load.tipo === 'FULL_MARKETPLACE') {
      return (load.destino_full_id && destinationById.get(load.destino_full_id)) || (load.marketplace_id && channelById.get(load.marketplace_id)) || '-';
    }
    return (load.loja_destino_id && storeById.get(load.loja_destino_id)) || load.loja_nome || '-';
  }

  const statusOptions = useMemo(() => Array.from(new Set(loads.map((l) => l.status).filter(Boolean))).sort((a, b) => a.localeCompare(b)), [loads]);
  const responsavelOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const l of loads) {
      if (!l.responsavel_operacional_id) continue;
      if (!byId.has(l.responsavel_operacional_id)) byId.set(l.responsavel_operacional_id, l.responsavel_nome || l.responsavel_operacional_id);
    }
    return Array.from(byId.entries()).map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [loads]);
  const supplierTextOptions = useMemo(() => {
    const values = Array.from(new Set(loads.flatMap((l) => (l.fornecedores || '').split(',').map((v) => v.trim()).filter(Boolean))));
    return values.sort((a, b) => a.localeCompare(b));
  }, [loads]);

  const filteredLoads = useMemo(
    () =>
      loads.filter((l) => {
        if (filters.tipo && l.tipo !== filters.tipo) return false;
        if (filters.status && l.status !== filters.status) return false;
        if (filters.empresa && l.empresa_id !== filters.empresa) return false;
        if (filters.marketplace && l.marketplace_id !== filters.marketplace) return false;
        if (filters.loja && l.loja_destino_id !== filters.loja) return false;
        if (filters.fornecedor && !(l.fornecedores || '').toLowerCase().includes(filters.fornecedor.toLowerCase())) return false;
        if (filters.responsavel && l.responsavel_operacional_id !== filters.responsavel) return false;
        return true;
      }),
    [loads, filters],
  );

  async function reschedule(loadId: string, isoDate: string) {
    const previous = loads;
    setLoads((prev) => prev.map((l) => (l.id === loadId ? { ...l, data_agendada: isoDate } : l)));
    const res = await fetch(`/api/loads/${loadId}/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataAgendada: isoDate }),
    });
    if (!res.ok) {
      setLoads(previous);
      return false;
    }
    fetchLoads();
    return true;
  }

  function goToday() {
    setCursor(new Date());
  }

  function goPrev() {
    setCursor((c) => {
      if (view === 'month') return new Date(c.getFullYear(), c.getMonth() - 1, 1);
      if (view === 'week') return addDays(c, -7);
      return addDays(c, -1);
    });
  }

  function goNext() {
    setCursor((c) => {
      if (view === 'month') return new Date(c.getFullYear(), c.getMonth() + 1, 1);
      if (view === 'week') return addDays(c, 7);
      return addDays(c, 1);
    });
  }

  const title = useMemo(() => {
    if (view === 'month') return cursor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    if (view === 'week') {
      const from = startOfWeek(cursor);
      const to = addDays(from, 6);
      const sameMonth = from.getMonth() === to.getMonth();
      const fromLabel = from.toLocaleDateString('pt-BR', { day: '2-digit', month: sameMonth ? undefined : 'short' });
      const toLabel = to.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
      return `${fromLabel} – ${toLabel}`;
    }
    return cursor.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  }, [view, cursor]);

  const newLoadHref = `/cargas?data_agendada=${encodeURIComponent(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), 9, 0, 0).toISOString())}`;

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[560px] flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={goToday}>Hoje</Button>
          <div className="flex overflow-hidden rounded-lg border border-zinc-300">
            <button className="p-2 text-zinc-500 hover:bg-zinc-50" onClick={goPrev} aria-label="Anterior"><ChevronLeft className="h-4 w-4" /></button>
            <button className="border-l border-zinc-300 p-2 text-zinc-500 hover:bg-zinc-50" onClick={goNext} aria-label="Próximo"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <h2 className="text-lg font-semibold capitalize text-zinc-900">{title}</h2>
          {loading && <span className="text-xs text-zinc-400">Atualizando...</span>}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-zinc-300 text-sm">
            {([['month', 'Mês'], ['week', 'Semana'], ['day', 'Dia']] as const).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn('px-3 py-1.5 font-medium', view === v ? 'bg-brand-600 text-white' : 'bg-white text-zinc-600 hover:bg-zinc-50')}
              >
                {label}
              </button>
            ))}
          </div>
          <Link href={newLoadHref}>
            <Button variant="primary" size="sm">
              <Plus className="h-4 w-4" />
              Nova carga
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select className="w-36" value={filters.tipo} onChange={(e) => setFilters((f) => ({ ...f, tipo: e.target.value }))}>
          <option value="">Tipo</option>
          <option value="FULL_MARKETPLACE">Full</option>
          <option value="LOJA_FISICA">Loja</option>
        </Select>
        <Select className="w-44" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
          <option value="">Status</option>
          {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select className="w-44" value={filters.empresa} onChange={(e) => setFilters((f) => ({ ...f, empresa: e.target.value }))}>
          <option value="">Empresa</option>
          {options.companies.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </Select>
        <Select className="w-44" value={filters.marketplace} onChange={(e) => setFilters((f) => ({ ...f, marketplace: e.target.value }))}>
          <option value="">Marketplace</option>
          {options.channels.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </Select>
        <Select className="w-40" value={filters.loja} onChange={(e) => setFilters((f) => ({ ...f, loja: e.target.value }))}>
          <option value="">Loja</option>
          {options.stores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </Select>
        <Select className="w-40" value={filters.fornecedor} onChange={(e) => setFilters((f) => ({ ...f, fornecedor: e.target.value }))}>
          <option value="">Fornecedor</option>
          {supplierTextOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select className="w-44" value={filters.responsavel} onChange={(e) => setFilters((f) => ({ ...f, responsavel: e.target.value }))}>
          <option value="">Responsável</option>
          {responsavelOptions.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
        </Select>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      {view === 'month' && (
        <MonthView
          year={cursor.getFullYear()}
          month={cursor.getMonth()}
          loads={filteredLoads}
          canEditDate={canEditDate}
          onOpenLoad={setSelectedLoad}
          onDropLoad={(load, day) => {
            const original = load.data_agendada ? new Date(load.data_agendada) : new Date();
            const next = new Date(day);
            next.setHours(original.getHours(), original.getMinutes(), 0, 0);
            reschedule(load.id, next.toISOString());
          }}
        />
      )}
      {view === 'week' && (
        <WeekView
          weekStart={startOfWeek(cursor)}
          loads={filteredLoads}
          canEditDate={canEditDate}
          onOpenLoad={setSelectedLoad}
          onDropLoad={(load, dt) => reschedule(load.id, dt.toISOString())}
        />
      )}
      {view === 'day' && (
        <DayView
          day={cursor}
          loads={filteredLoads}
          destinoDisplay={destinoDisplay}
          canEditDate={canEditDate}
          onOpenLoad={setSelectedLoad}
          onDropLoad={(load, dt) => reschedule(load.id, dt.toISOString())}
        />
      )}

      {selectedLoad && (
        <EventDetailDialog
          load={selectedLoad}
          destinoDisplay={destinoDisplay(selectedLoad)}
          empresaNome={(selectedLoad.empresa_id && companyById.get(selectedLoad.empresa_id)) || '-'}
          canEditDate={canEditDate}
          onClose={() => setSelectedLoad(null)}
          onReschedule={reschedule}
        />
      )}
    </div>
  );
}
