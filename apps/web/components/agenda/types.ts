export type SelectOption = { id: string; nome: string };

export type AgendaOptions = {
  companies: SelectOption[];
  channels: SelectOption[];
  stores: SelectOption[];
  fullDestinations: SelectOption[];
  suppliers: SelectOption[];
};

export type AgendaLoad = {
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

export type AgendaFilters = {
  tipo: string;
  status: string;
  empresa: string;
  marketplace: string;
  loja: string;
  fornecedor: string;
  responsavel: string;
};

export const EMPTY_FILTERS: AgendaFilters = {
  tipo: '',
  status: '',
  empresa: '',
  marketplace: '',
  loja: '',
  fornecedor: '',
  responsavel: '',
};

export function alertLabel(alertType: string) {
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

export function pad2(n: number) {
  return String(n).padStart(2, '0');
}

export function dateKey(value: Date) {
  return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
}

export function dateKeyFromIso(value: string) {
  return dateKey(new Date(value));
}

export function timeFromIso(value: string) {
  const d = new Date(value);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function isSameDay(a: Date, b: Date) {
  return dateKey(a) === dateKey(b);
}

export function startOfWeek(d: Date) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() - copy.getDay());
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function addDays(d: Date, days: number) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function monthMatrix(year: number, month: number) {
  const first = new Date(year, month, 1);
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

// Flags loads that share the same day, time and destination — a likely
// double-booking. Computed once from whatever loads are currently loaded
// (the active view's range), so it works the same in month, week and day.
export function computeConflicts(loads: AgendaLoad[]): Map<string, boolean> {
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
}
