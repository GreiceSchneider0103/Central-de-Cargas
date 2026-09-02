'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { loadStatusTone, TONE_EVENT_PILL } from '@/lib/ui/status-styles';
import { alertLabel, dateKey, timeFromIso, type AgendaLoad } from './types';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_HEIGHT = 56;

export function DayView({
  day,
  loads,
  conflictByLoadId,
  destinoDisplay,
  canEditDate,
  onOpenLoad,
  onDropLoad,
}: {
  day: Date;
  loads: AgendaLoad[];
  conflictByLoadId: Map<string, boolean>;
  destinoDisplay: (load: AgendaLoad) => string;
  canEditDate: boolean;
  onOpenLoad: (load: AgendaLoad) => void;
  onDropLoad: (load: AgendaLoad, newDateTime: Date) => void;
}) {
  const [dragLoadId, setDragLoadId] = useState<string | null>(null);
  const [dragOverHour, setDragOverHour] = useState<number | null>(null);
  const loadsById = useMemo(() => new Map(loads.map((l) => [l.id, l])), [loads]);

  const dayLoads = useMemo(
    () => loads.filter((l) => l.data_agendada && dateKey(new Date(l.data_agendada)) === dateKey(day)).sort((a, b) => (a.data_agendada ?? '').localeCompare(b.data_agendada ?? '')),
    [loads, day],
  );

  const byHour = useMemo(() => {
    const map = new Map<number, AgendaLoad[]>();
    for (const l of dayLoads) {
      const h = new Date(l.data_agendada as string).getHours();
      if (!map.has(h)) map.set(h, []);
      map.get(h)!.push(l);
    }
    return map;
  }, [dayLoads]);

  if (dayLoads.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-card border border-zinc-200 bg-white">
        <EmptyState title="Nenhuma carga agendada nesse dia" description="Use o botão “Nova carga” para agendar uma." />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-card border border-zinc-200 bg-white">
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-[56px_1fr]">
          <div>
            {HOURS.map((h) => (
              <div key={h} style={{ height: HOUR_HEIGHT }} className="border-b border-zinc-100 pr-2 text-right text-[10px] text-zinc-400">
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>
          <div className="border-l border-zinc-100">
            {HOURS.map((h) => {
              const events = byHour.get(h) ?? [];
              return (
                <div
                  key={h}
                  style={{ height: HOUR_HEIGHT }}
                  className={cn('flex flex-col gap-1 border-b border-zinc-100 p-1', dragOverHour === h && 'bg-brand-50 ring-1 ring-inset ring-brand-300')}
                  onDragOver={(e) => {
                    if (!canEditDate) return;
                    e.preventDefault();
                    setDragOverHour(h);
                  }}
                  onDragLeave={() => setDragOverHour((v) => (v === h ? null : v))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverHour(null);
                    if (!canEditDate || !dragLoadId) return;
                    const load = loadsById.get(dragLoadId);
                    if (load) {
                      const original = load.data_agendada ? new Date(load.data_agendada) : new Date();
                      const next = new Date(day);
                      next.setHours(h, original.getMinutes(), 0, 0);
                      onDropLoad(load, next);
                    }
                    setDragLoadId(null);
                  }}
                >
                  {events.map((load) => {
                    const hasConflict = conflictByLoadId.get(load.id);
                    return (
                    <button
                      key={load.id}
                      type="button"
                      draggable={canEditDate}
                      onDragStart={(e) => {
                        setDragLoadId(load.id);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragEnd={() => setDragLoadId(null)}
                      onClick={() => onOpenLoad(load)}
                      className={cn(
                        'flex items-center gap-2 rounded-md px-2 py-1 text-left text-xs',
                        TONE_EVENT_PILL[loadStatusTone(load.status)],
                        canEditDate && 'cursor-grab active:cursor-grabbing',
                      )}
                    >
                      <span className="tabular-nums opacity-70">{timeFromIso(load.data_agendada as string)}</span>
                      <span className="font-semibold">{load.codigo_interno}</span>
                      <span className="truncate text-zinc-600">{destinoDisplay(load)}</span>
                      <Badge tone={loadStatusTone(load.status)} className="ml-auto shrink-0">{load.status}</Badge>
                      {hasConflict ? (
                        <span className="flex shrink-0 items-center gap-1 text-amber-700">
                          <AlertTriangle className="h-3 w-3" />
                          Conflito de agendamento
                        </span>
                      ) : (load.alerts?.length ?? 0) > 0 && (
                        <span className="flex shrink-0 items-center gap-1 text-amber-700">
                          <AlertTriangle className="h-3 w-3" />
                          {alertLabel(load.alerts![0].alert_type)}
                        </span>
                      )}
                    </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
