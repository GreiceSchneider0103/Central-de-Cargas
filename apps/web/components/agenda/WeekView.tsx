'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { EventPill } from './EventPill';
import { addDays, dateKey, dateKeyFromIso, type AgendaLoad } from './types';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_HEIGHT = 48;

export function WeekView({
  weekStart,
  loads,
  conflictByLoadId,
  canEditDate,
  onOpenLoad,
  onDropLoad,
}: {
  weekStart: Date;
  loads: AgendaLoad[];
  conflictByLoadId: Map<string, boolean>;
  canEditDate: boolean;
  onOpenLoad: (load: AgendaLoad) => void;
  onDropLoad: (load: AgendaLoad, newDateTime: Date) => void;
}) {
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const [dragLoadId, setDragLoadId] = useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);
  const loadsById = useMemo(() => new Map(loads.map((l) => [l.id, l])), [loads]);
  const today = dateKey(new Date());

  const byDayHour = useMemo(() => {
    const map = new Map<string, AgendaLoad[]>();
    for (const l of loads) {
      if (!l.data_agendada) continue;
      const d = new Date(l.data_agendada);
      const key = `${dateKeyFromIso(l.data_agendada)}|${d.getHours()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(l);
    }
    return map;
  }, [loads]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-card border border-zinc-200 bg-white">
      <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-zinc-200 bg-zinc-50 text-xs font-semibold text-zinc-500">
        <div />
        {days.map((d) => (
          <div key={dateKey(d)} className="flex flex-col items-center py-2">
            <span>{d.toLocaleDateString('pt-BR', { weekday: 'short' })}</span>
            <span
              className={cn(
                'mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold',
                dateKey(d) === today ? 'bg-brand-600 text-white' : 'text-zinc-700',
              )}
            >
              {d.getDate()}
            </span>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-[56px_repeat(7,1fr)]">
          <div>
            {HOURS.map((h) => (
              <div key={h} style={{ height: HOUR_HEIGHT }} className="border-b border-zinc-100 pr-2 text-right text-[10px] text-zinc-400">
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>
          {days.map((d) => (
            <div key={dateKey(d)} className="border-l border-zinc-100">
              {HOURS.map((h) => {
                const key = `${dateKey(d)}|${h}`;
                const events = byDayHour.get(key) ?? [];
                return (
                  <div
                    key={h}
                    style={{ height: HOUR_HEIGHT }}
                    className={cn(
                      'flex gap-0.5 border-b border-zinc-100 p-0.5',
                      dragOverSlot === key && 'bg-brand-50 ring-1 ring-inset ring-brand-300',
                    )}
                    onDragOver={(e) => {
                      if (!canEditDate) return;
                      e.preventDefault();
                      setDragOverSlot(key);
                    }}
                    onDragLeave={() => setDragOverSlot((k) => (k === key ? null : k))}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverSlot(null);
                      if (!canEditDate || !dragLoadId) return;
                      const load = loadsById.get(dragLoadId);
                      if (load) {
                        const original = load.data_agendada ? new Date(load.data_agendada) : new Date();
                        const next = new Date(d);
                        next.setHours(h, original.getMinutes(), 0, 0);
                        onDropLoad(load, next);
                      }
                      setDragLoadId(null);
                    }}
                  >
                    {events.map((load) => (
                      <div key={load.id} className="min-w-0 flex-1">
                        <EventPill
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
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
