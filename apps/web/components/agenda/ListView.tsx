'use client';

import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { loadStatusTone } from '@/lib/ui/status-styles';
import { alertLabel, type AgendaLoad } from './types';

export function ListView({
  loads,
  from,
  to,
  conflictByLoadId,
  destinoDisplay,
  onOpenLoad,
}: {
  loads: AgendaLoad[];
  from: Date;
  to: Date;
  conflictByLoadId: Map<string, boolean>;
  destinoDisplay: (load: AgendaLoad) => string;
  onOpenLoad: (load: AgendaLoad) => void;
}) {
  const rows = useMemo(
    () =>
      loads
        .filter((l) => {
          if (!l.data_agendada) return false;
          const d = new Date(l.data_agendada);
          return d >= from && d < to;
        })
        .sort((a, b) => (a.data_agendada ?? '').localeCompare(b.data_agendada ?? '')),
    [loads, from, to],
  );

  if (rows.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-card border border-zinc-200 bg-white">
        <EmptyState title="Nenhuma carga agendada nesse mês" description="Use o botão “Nova carga” para agendar uma." />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto rounded-card border border-zinc-200 bg-white">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10">
          <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-medium text-zinc-500">
            <th className="px-3 py-2.5">Data</th>
            <th className="px-3 py-2.5">Carga</th>
            <th className="px-3 py-2.5">Destino</th>
            <th className="px-3 py-2.5">Fornecedores</th>
            <th className="px-3 py-2.5">Responsável</th>
            <th className="px-3 py-2.5">Status</th>
            <th className="px-3 py-2.5">Alertas</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => {
            const alert = conflictByLoadId.get(l.id)
              ? 'Conflito de agendamento'
              : l.alerts?.length
                ? alertLabel(l.alerts[0].alert_type) + (l.alerts.length > 1 ? ` +${l.alerts.length - 1}` : '')
                : null;
            return (
              <tr key={l.id} className="cursor-pointer border-b border-zinc-50 align-top last:border-0 hover:bg-zinc-50" onClick={() => onOpenLoad(l)}>
                <td className="whitespace-nowrap px-3 py-2 text-zinc-700">
                  {new Date(l.data_agendada as string).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-medium text-brand-700">{l.codigo_interno}</td>
                <td className="px-3 py-2 text-zinc-600">
                  {l.tipo === 'FULL_MARKETPLACE' ? 'Full' : 'Loja'} · {destinoDisplay(l)}
                </td>
                <td className="max-w-[16rem] truncate px-3 py-2 text-zinc-600" title={l.fornecedores || undefined}>{l.fornecedores || '-'}</td>
                <td className="px-3 py-2 text-zinc-600">{l.responsavel_nome || '-'}</td>
                <td className="whitespace-nowrap px-3 py-2"><Badge tone={loadStatusTone(l.status)} dot>{l.status}</Badge></td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-amber-700">
                  {alert ? (
                    <span className="inline-flex items-center gap-1" title={l.alerts?.map((a) => alertLabel(a.alert_type)).join('\n')}>
                      <AlertTriangle className="h-3 w-3" />
                      {alert}
                    </span>
                  ) : (
                    <span className="text-zinc-300">-</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
