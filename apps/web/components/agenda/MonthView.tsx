'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EventPill } from './EventPill';
import { dateKey, dateKeyFromIso, monthMatrix, timeFromIso, type AgendaLoad } from './types';

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MAX_VISIBLE_PER_DAY = 3;

export function MonthView({
  year,
  month,
  loads,
  canEditDate,
  onOpenLoad,
  onDropLoad,
}: {
  year: number;
  month: number;
  loads: AgendaLoad[];
  canEditDate: boolean;
  onOpenLoad: (load: AgendaLoad) => void;
  onDropLoad: (load: AgendaLoad, newDay: Date) => void;
}) {
  const days = useMemo(() => monthMatrix(year, month), [year, month]);
  const [dragLoadId, setDragLoadId] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const byDay = useMemo(() => {
    const map = new Map<string, AgendaLoad[]>();
    for (const l of loads) {
      if (!l.data_agendada) continue;
      const key = dateKeyFromIso(l.data_agendada);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(l);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.data_agendada ?? '').localeCompare(b.data_agendada ?? ''));
    }
    return map;
  }, [loads]);

  const conflictByLoadId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of loads) {
      if (!l.data_agendada) continue;
      const destKey = l.destino_full_id || l.loja_destino_id || l.marketplace_id || 'unknown';
      const k = `${dateKeyFromIso(l.data_agendada)}|${timeFromIso(l.data_agendada)}|${destKey}`;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const byLoad = new Map<string, boolean>();
    for (const l of loads) {
      if (!l.data_agendada) continue;
      const destKey = l.destino_full_id || l.loja_destino_id || l.marketplace_id || 'unknown';
      const k = `${dateKeyFromIso(l.data_agendada)}|${timeFromIso(l.data_agendada)}|${destKey}`;
      byLoad.set(l.id, (counts.get(k) ?? 0) > 1);
    }
    return byLoad;
  }, [loads]);

  const loadsById = useMemo(() => new Map(loads.map((l) => [l.id, l])), [loads]);
  const today = dateKey(new Date());

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-card border border-zinc-200 bg-white">
      <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50 text-xs font-semibold text-zinc-500">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="px-2 py-2 text-center">{d}</div>
        ))}
      </div>
      <div className="grid flex-1 grid-cols-7 grid-rows-6">
        {days.map((d) => {
          const key = dateKey(d);
          const events = byDay.get(key) ?? [];
          const isCurrentMonth = d.getMonth() === month;
          const isToday = key === today;
          const isExpanded = expandedDay === key;
          const visible = isExpanded ? events : events.slice(0, MAX_VISIBLE_PER_DAY);
          const hiddenCount = events.length - visible.length;
          const startOfDayIso = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9, 0, 0).toISOString();

          return (
            <div
              key={key}
              className={cn(
                'group relative flex min-h-[104px] flex-col gap-1 border-b border-r border-zinc-100 p-1.5',
                !isCurrentMonth && 'bg-zinc-50/60',
                dragOverKey === key && 'bg-brand-50 ring-1 ring-inset ring-brand-300',
              )}
              onDragOver={(e) => {
                if (!canEditDate) return;
                e.preventDefault();
                setDragOverKey(key);
              }}
              onDragLeave={() => setDragOverKey((k) => (k === key ? null : k))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverKey(null);
                if (!canEditDate || !dragLoadId) return;
                const load = loadsById.get(dragLoadId);
                if (load) onDropLoad(load, d);
                setDragLoadId(null);
              }}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                    isToday ? 'bg-brand-600 text-white' : isCurrentMonth ? 'text-zinc-700' : 'text-zinc-400',
                  )}
                >
                  {d.getDate()}
                </span>
                <Link
                  href={`/cargas?data_agendada=${encodeURIComponent(startOfDayIso)}`}
                  className="hidden rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-brand-600 group-hover:block"
                  title="Criar carga com data agendada"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                {visible.map((load) => (
                  <EventPill
                    key={load.id}
                    load={load}
                    draggable={canEditDate}
                    conflict={conflictByLoadId.get(load.id)}
                    onClick={() => onOpenLoad(load)}
                    onDragStart={(e) => {
                      setDragLoadId(load.id);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragEnd={() => setDragLoadId(null)}
                  />
                ))}
                {hiddenCount > 0 && (
                  <button
                    className="px-1.5 text-left text-[11px] font-medium text-zinc-500 hover:text-brand-600"
                    onClick={() => setExpandedDay(key)}
                  >
                    +{hiddenCount} mais
                  </button>
                )}
                {isExpanded && events.length > MAX_VISIBLE_PER_DAY && (
                  <button
                    className="px-1.5 text-left text-[11px] font-medium text-zinc-500 hover:text-brand-600"
                    onClick={() => setExpandedDay(null)}
                  >
                    ver menos
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
