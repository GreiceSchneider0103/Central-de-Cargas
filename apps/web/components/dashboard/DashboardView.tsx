'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Package2,
  CalendarClock,
  CalendarRange,
  ClipboardList,
  AlertTriangle,
  Truck,
  Boxes,
  Tag,
  FileWarning,
  PackageCheck,
  DollarSign,
  ArrowRight,
} from 'lucide-react';
import type { UserProfile } from '@/lib/auth/roles';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Select } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/EmptyState';

type Load = Record<string, string | number | null | undefined>;

type Props = {
  profile: UserProfile;
  loads: Load[];
  pendingRequests: number;
  metrics?: null | {
    loads_day?: number | null;
    loads_week?: number | null;
    loads_month?: number | null;
    loads_pending?: number | null;
    loads_overdue?: number | null;
    loads_wait_supplier?: number | null;
    loads_wait_receipt?: number | null;
    loads_wait_label?: number | null;
    loads_wait_nf?: number | null;
    loads_ready_pickup?: number | null;
    fin_revenue_month?: number | null;
    fin_cmv_month?: number | null;
    fin_freight_month?: number | null;
    fin_margin_month?: number | null;
  };
};

function countBy(loads: Load[], pred: (l: Load) => boolean) {
  return loads.filter(pred).length;
}

function money(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function DashboardView({ profile, loads, pendingRequests, metrics = null }: Props) {
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const canSeeFinancial = ['admin', 'gerente_estoque', 'financeiro', 'gerente_ecommerce'].includes(profile.perfil);

  const filtered = useMemo(
    () =>
      loads.filter((l) => {
        if (statusFilter && l.status !== statusFilter) return false;
        if (typeFilter && l.tipo !== typeFilter) return false;
        return true;
      }),
    [loads, statusFilter, typeFilter],
  );

  const statusOptions = useMemo(
    () => Array.from(new Set(loads.map((l) => String(l.status ?? '')).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [loads],
  );

  const cards = useMemo(() => {
    if (metrics) {
      return {
        d: Number(metrics.loads_day ?? 0),
        w: Number(metrics.loads_week ?? 0),
        m: Number(metrics.loads_month ?? 0),
        pend: Number(metrics.loads_pending ?? 0),
        atras: Number(metrics.loads_overdue ?? 0),
        aguForn: Number(metrics.loads_wait_supplier ?? 0),
        aguRec: Number(metrics.loads_wait_receipt ?? 0),
        aguEtiq: Number(metrics.loads_wait_label ?? 0),
        aguNF: Number(metrics.loads_wait_nf ?? 0),
        prontaCol: Number(metrics.loads_ready_pickup ?? 0),
        fat: Number(metrics.fin_revenue_month ?? 0),
        cmv: Number(metrics.fin_cmv_month ?? 0),
        frete: Number(metrics.fin_freight_month ?? 0),
        margem: Number(metrics.fin_margin_month ?? 0),
      };
    }

    const now = new Date();
    const startDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startWeek = new Date(startDay);
    startWeek.setDate(startDay.getDate() - startDay.getDay());
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const d = countBy(filtered, (l) => Boolean(l.data_agendada) && new Date(String(l.data_agendada)) >= startDay && new Date(String(l.data_agendada)) < new Date(startDay.getTime() + 86400000));
    const w = countBy(filtered, (l) => Boolean(l.data_agendada) && new Date(String(l.data_agendada)) >= startWeek);
    const m = countBy(filtered, (l) => Boolean(l.data_agendada) && new Date(String(l.data_agendada)) >= startMonth);
    const pend = countBy(filtered, (l) => l.status === 'Rascunho' || l.status === 'Aguardando aprovação');
    const atras = countBy(filtered, (l) => Boolean(l.data_agendada) && new Date(String(l.data_agendada)) < now && !['Finalizada', 'Entregue', 'Cancelada'].includes(String(l.status)));
    const aguForn = countBy(filtered, (l) => l.status === 'Aguardando fornecedor');
    const aguRec = countBy(filtered, (l) => l.status === 'Aguardando recebimento');
    const aguEtiq = countBy(filtered, (l) => l.status === 'Etiquetando');
    const aguNF = countBy(filtered, (l) => l.status === 'Aguardando NF');
    const prontaCol = countBy(filtered, (l) => l.status === 'Pronta para coleta');

    const fat = filtered.reduce((s, l) => s + Number(l.faturamento_estimado ?? 0), 0);
    const cmv = filtered.reduce((s, l) => s + Number(l.cmv_total ?? 0), 0);
    const frete = filtered.reduce((s, l) => s + Number(l.custo_frete ?? 0), 0);
    const margem = filtered.reduce((s, l) => s + Number(l.margem_estimativa_valor ?? 0), 0);

    return { d, w, m, pend, atras, aguForn, aguRec, aguEtiq, aguNF, prontaCol, fat, cmv, frete, margem };
  }, [filtered, metrics]);

  const alerts = useMemo(() => {
    const list: { label: string; count: number }[] = [
      { label: 'Cargas atrasadas', count: cards.atras },
      { label: 'Cargas sem CMV', count: countBy(filtered, (l) => l.cmv_total != null && Number(l.cmv_total) <= 0) },
      { label: 'Sem data de recebimento', count: countBy(filtered, (l) => !l.data_prevista_recebimento) },
      { label: 'Aguardando fornecedor', count: cards.aguForn },
      { label: 'Aguardando NF', count: cards.aguNF },
      { label: 'Aguardando etiqueta', count: cards.aguEtiq },
      { label: 'Solicitações pendentes', count: pendingRequests },
    ];
    return list.filter((a) => a.count > 0);
  }, [filtered, cards, pendingRequests]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Dashboard operacional</h1>
          <p className="text-sm text-zinc-500">Visão geral das cargas e do que precisa de atenção agora.</p>
        </div>
        <div className="flex gap-2">
          <Select className="w-40" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">Todos os tipos</option>
            <option value="FULL_MARKETPLACE">Full</option>
            <option value="LOJA_FISICA">Loja</option>
          </Select>
          <Select className="w-48" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Todos os status</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Cargas do dia" value={cards.d} icon={CalendarClock} tone="brand" />
        <StatCard label="Cargas da semana" value={cards.w} icon={CalendarRange} tone="info" />
        <StatCard label="Cargas do mês" value={cards.m} icon={Package2} tone="info" />
        <StatCard label="Solicitações pendentes" value={pendingRequests} icon={ClipboardList} tone="warning" />
        <StatCard label="Cargas atrasadas" value={cards.atras} icon={AlertTriangle} tone="danger" />
        <StatCard label="Aguardando fornecedor" value={cards.aguForn} icon={Truck} tone="warning" />
        <StatCard label="Aguardando recebimento" value={cards.aguRec} icon={Boxes} tone="warning" />
        <StatCard label="Aguardando etiqueta" value={cards.aguEtiq} icon={Tag} tone="progress" />
        <StatCard label="Aguardando NF" value={cards.aguNF} icon={FileWarning} tone="warning" />
        <StatCard label="Prontas para coleta" value={cards.prontaCol} icon={PackageCheck} tone="brand" />
        {canSeeFinancial && (
          <>
            <StatCard label="Faturamento estimado" value={money(cards.fat)} icon={DollarSign} tone="success" />
            <StatCard label="Margem estimada" value={money(cards.margem)} icon={DollarSign} tone={cards.margem >= 0 ? 'success' : 'danger'} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Precisa de atenção" description="Cargas e solicitações que pedem uma ação sua." />
          <CardBody>
            {alerts.length === 0 ? (
              <EmptyState icon={PackageCheck} title="Tudo em dia" description="Nenhum alerta pendente no momento." />
            ) : (
              <ul className="divide-y divide-zinc-100">
                {alerts.map((a) => (
                  <li key={a.label} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="flex items-center gap-2 text-zinc-700">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      {a.label}
                    </span>
                    <span className="font-semibold text-zinc-900">{a.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {canSeeFinancial && (
          <Card>
            <CardHeader title="Financeiro do mês" />
            <CardBody className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-zinc-500">CMV total</span><span className="font-medium">{money(cards.cmv)}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Custo de frete</span><span className="font-medium">{money(cards.frete)}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Faturamento</span><span className="font-medium">{money(cards.fat)}</span></div>
              <div className="flex justify-between border-t border-zinc-100 pt-3"><span className="text-zinc-500">Margem</span><span className={cards.margem >= 0 ? 'font-semibold text-emerald-700' : 'font-semibold text-rose-700'}>{money(cards.margem)}</span></div>
            </CardBody>
          </Card>
        )}
      </div>

      <Link href="/relatorios" className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700">
        Ver relatórios detalhados por empresa, marketplace, loja e fornecedor
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
