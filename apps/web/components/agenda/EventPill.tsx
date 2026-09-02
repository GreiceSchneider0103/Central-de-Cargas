'use client';

import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TONE_EVENT_PILL, loadStatusTone } from '@/lib/ui/status-styles';
import { timeFromIso, type AgendaLoad } from './types';

export function EventPill({
  load,
  draggable,
  conflict,
  onClick,
  onDragStart,
  onDragEnd,
  dense = false,
}: {
  load: AgendaLoad;
  draggable: boolean;
  conflict?: boolean;
  onClick: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  dense?: boolean;
}) {
  const tone = loadStatusTone(load.status);
  const time = load.data_agendada ? timeFromIso(load.data_agendada) : null;
  const hasAlerts = (load.alerts?.length ?? 0) > 0 || conflict;

  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      title={`${load.codigo_interno} • ${load.status}${conflict ? ' • Conflito de agendamento' : ''}`}
      className={cn(
        'group flex w-full items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-left text-[11px] font-medium leading-tight transition-colors',
        TONE_EVENT_PILL[tone],
        draggable && 'cursor-grab active:cursor-grabbing',
        dense && 'py-1 text-xs',
      )}
    >
      {time && <span className="shrink-0 tabular-nums opacity-70">{time}</span>}
      <span className="truncate">{load.codigo_interno}</span>
      {hasAlerts && <AlertTriangle className="ml-auto h-3 w-3 shrink-0 text-amber-600" />}
    </button>
  );
}
