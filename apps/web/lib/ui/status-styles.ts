export type StatusTone = 'neutral' | 'warning' | 'info' | 'brand' | 'progress' | 'success' | 'danger';

export const TONE_BADGE: Record<StatusTone, string> = {
  neutral: 'bg-zinc-100 text-zinc-700',
  warning: 'bg-amber-100 text-amber-800',
  info: 'bg-sky-100 text-sky-800',
  brand: 'bg-brand-100 text-brand-700',
  progress: 'bg-teal-100 text-teal-800',
  success: 'bg-emerald-100 text-emerald-800',
  danger: 'bg-rose-100 text-rose-800',
};

export const TONE_DOT: Record<StatusTone, string> = {
  neutral: 'bg-zinc-400',
  warning: 'bg-amber-500',
  info: 'bg-sky-500',
  brand: 'bg-brand-600',
  progress: 'bg-teal-500',
  success: 'bg-emerald-500',
  danger: 'bg-rose-500',
};

export const TONE_EVENT_PILL: Record<StatusTone, string> = {
  neutral: 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200',
  warning: 'bg-amber-100 text-amber-800 hover:bg-amber-200',
  info: 'bg-sky-100 text-sky-800 hover:bg-sky-200',
  brand: 'bg-brand-100 text-brand-700 hover:bg-brand-200',
  progress: 'bg-teal-100 text-teal-800 hover:bg-teal-200',
  success: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200',
  danger: 'bg-rose-100 text-rose-800 hover:bg-rose-200',
};

const LOAD_STATUS_TONE: Record<string, StatusTone> = {
  Rascunho: 'neutral',
  'Aguardando aprovação': 'warning',
  Aprovada: 'info',
  'Aguardando fornecedor': 'warning',
  'Pedido realizado': 'info',
  'Pedido confirmado': 'info',
  'Aguardando recebimento': 'warning',
  'Produto recebido': 'progress',
  'Em preparação': 'progress',
  Separando: 'progress',
  Etiquetando: 'progress',
  'Aguardando NF': 'warning',
  'Pronta para agendamento': 'brand',
  Agendada: 'brand',
  'Pronta para coleta': 'brand',
  Carregada: 'progress',
  'Em trânsito': 'progress',
  Entregue: 'success',
  Finalizada: 'success',
  Cancelada: 'danger',
  'Com divergência': 'danger',
};

const REQUEST_STATUS_TONE: Record<string, StatusTone> = {
  Pendente: 'warning',
  'Em análise': 'info',
  Aprovada: 'success',
  Recusada: 'danger',
  'Ajuste solicitado': 'warning',
  'Transformada em carga': 'brand',
  Cancelada: 'neutral',
};

const PRIORITY_TONE: Record<string, StatusTone> = {
  Baixa: 'neutral',
  Média: 'info',
  Alta: 'warning',
  Urgente: 'danger',
};

export function loadStatusTone(status: string | null | undefined): StatusTone {
  return (status && LOAD_STATUS_TONE[status]) || 'neutral';
}

export function requestStatusTone(status: string | null | undefined): StatusTone {
  return (status && REQUEST_STATUS_TONE[status]) || 'neutral';
}

export function priorityTone(priority: string | null | undefined): StatusTone {
  return (priority && PRIORITY_TONE[priority]) || 'neutral';
}

export function loadTypeTone(tipo: string | null | undefined): StatusTone {
  return tipo === 'FULL_MARKETPLACE' ? 'brand' : 'progress';
}
