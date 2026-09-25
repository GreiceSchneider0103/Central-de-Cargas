'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  CalendarClock,
  ClipboardList,
  AlertTriangle,
  Truck,
  Boxes,
  Tag,
  FileWarning,
  PackageCheck,
  ArrowRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { UserProfile } from '@/lib/auth/roles';
import { Badge } from '@/components/ui/Badge';
import { loadStatusTone, type StatusTone } from '@/lib/ui/status-styles';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Select } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/EmptyState';
import { money } from '@/lib/ui/format';
import { createClient } from '@/lib/supabase/client';

type Load = Record<string, string | number | null | undefined>;

type DashboardMetrics = {
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

type Props = {
  profile: UserProfile;
  loads: Load[];
  upcoming?: Load[];
  pendingRequests: number;
  metrics?: null | DashboardMetrics;
};

function LinkedStat({ href, ...props }: { href: string; label: string; value: string | number; icon: LucideIcon; tone: StatusTone; hint?: string }) {
  return (
    <Link href={href} className="block rounded-card transition-shadow hover:shadow-popover focus:outline-none focus:ring-2 focus:ring-brand-200">
      <StatCard {...props} className="h-full" />
    </Link>
  );
}

function countBy(loads: Load[], pred: (l: Load) => boolean) {
  return loads.filter(pred).length;
}

export function DashboardView({ profile, loads, upcoming = [], pendingRequests, metrics = null }: Props) {
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [liveMetrics, setLiveMetrics] = useState<DashboardMetrics | null>(metrics);
  const isFirstFilterRun = useRef(true);

  const canSeeFinancial = ['admin', 'gerente_estoque', 'financeiro', 'gerente_ecommerce'].includes(profile.perfil);

  useEffect(() => {
    if (isFirstFilterRun.current) {
      isFirstFilterRun.current = false;
      return;
    }
    let cancelled = false;
    const supabase = createClient();
    supabase
      .rpc('get_dashboard_metrics', { p_now: new Date().toISOString(), p_tipo: typeFilter || null, p_status: statusFilter || null })
      .then(({ data }) => {
        if (cancelled) return;
        const row = Array.isArray(data) ? data[0] : data;
        setLiveMetrics((row ?? null) as DashboardMetrics | null);
      });
    return () => {
      cancelled = true;
    };
  }, [typeFilter, statusFilter]);

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
    if (liveMetrics) {
      return {
        d: Number(liveMetrics.loads_day ?? 0),
        w: Number(liveMetrics.loads_week ?? 0),
        m: Number(liveMetrics.loads_month ?? 0),
        pend: Number(liveMetrics.loads_pending ?? 0),
        atras: Number(liveMetrics.loads_overdue ?? 0),
        aguForn: Number(liveMetrics.loads_wait_supplier ?? 0),
        aguRec: Number(liveMetrics.loads_wait_receipt ?? 0),
        aguEtiq: Number(liveMetrics.loads_wait_label ?? 0),
        aguNF: Number(liveMetrics.loads_wait_nf ?? 0),
        prontaCol: Number(liveMetrics.loads_ready_pickup ?? 0),
        fat: Number(liveMetrics.fin_revenue_month ?? 0),
        cmv: Number(liveMetrics.fin_cmv_month ?? 0),
        frete: Number(liveMetrics.fin_freight_month ?? 0),
        margem: Number(liveMetrics.fin_margin_month ?? 0),
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
  }, [filtered, liveMetrics]);

  const alerts = useMemo(() => {
    const list: { label: string; count: number; href: string }[] = [
      { label: 'Cargas atrasadas', count: cards.atras, href: '/operacao' },
      { label: 'Cargas sem CMV', count: countBy(filtered, (l) => l.cmv_total != null && Number(l.cmv_total) <= 0), href: '/cargas' },
      { label: 'Sem data de recebimento', count: countBy(filtered, (l) => !l.data_prevista_recebimento), href: '/cargas' },
      { label: 'Aguardando fornecedor', count: cards.aguForn, href: '/cargas' },
      { label: 'Aguardando NF', count: cards.aguNF, href: '/cargas' },
      { label: 'Aguardando etiqueta', count: cards.aguEtiq, href: '/cargas' },
      { label: 'Solicitações pendentes', count: pendingRequests, href: '/solicitacoes' },
    ];
    return list.filter((a) => a.count > 0);
  }, [filtered, cards, pendingRequests]);

  const upcomingRows = useMemo(
    () =>
      upcoming
        .filter((l) => l.status !== 'Cancelada')
        .filter((l) => (!typeFilter || l.tipo === typeFilter) && (!statusFilter || l.status === statusFilter))
        .sort((a, b) => String(a.data_agendada ?? '').localeCompare(String(b.data_agendada ?? '')))
        .slice(0, 12),
    [upcoming, typeFilter, statusFilter],
  );

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
        <LinkedStat href="/operacao" label="Cargas de hoje" value={cards.d} hint={`Semana: ${cards.w} · Mês: ${cards.m}`} icon={CalendarClock} tone="brand" />
        <LinkedStat href="/operacao" label="Atrasadas" value={cards.atras} icon={AlertTriangle} tone={cards.atras > 0 ? 'danger' : 'neutral'} />
        <LinkedStat href="/solicitacoes" label="Solicitações pendentes" value={pendingRequests} icon={ClipboardList} tone="warning" />
        <LinkedStat href="/operacao" label="Prontas para coleta" value={cards.prontaCol} icon={PackageCheck} tone="success" />
        <LinkedStat href="/cargas" label="Aguardando fornecedor" value={cards.aguForn} icon={Truck} tone="warning" />
        <LinkedStat href="/cargas" label="Aguardando recebimento" value={cards.aguRec} icon={Boxes} tone="warning" />
        <LinkedStat href="/cargas" label="Aguardando etiqueta" value={cards.aguEtiq} icon={Tag} tone="progress" />
        <LinkedStat href="/cargas" label="Aguardando NF" value={cards.aguNF} icon={FileWarning} tone="warning" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Próximas cargas"
            description="Agendadas de hoje até os próximos 7 dias."
            action={<Link href="/agenda" className="text-sm font-medium text-brand-600 hover:text-brand-700">Ver agenda</Link>}
          />
          <CardBody className="p-0">
            {upcomingRows.length === 0 ? (
              <EmptyState icon={CalendarClock} title="Nenhuma carga agendada" description="Nada agendado para os próximos 7 dias." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-medium text-zinc-500">
                      <th className="px-4 py-2">Quando</th>
                      <th className="px-4 py-2">Carga</th>
                      <th className="px-4 py-2">Destino</th>
                      <th className="px-4 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcomingRows.map((l) => (
                      <tr key={String(l.id)} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50">
                        <td className="whitespace-nowrap px-4 py-2 text-zinc-600">
                          {new Date(String(l.data_agendada)).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2">
                          <Link href={`/cargas/${l.id}`} className="font-medium text-brand-700 hover:underline">{String(l.codigo_interno ?? 'Carga')}</Link>
                        </td>
                        <td className="px-4 py-2 text-zinc-600">
                          {l.tipo === 'FULL_MARKETPLACE' ? 'Full' : 'Loja'}
                          {(l.loja_nome || l.canal_nome) && <span className="text-zinc-400"> · {String(l.loja_nome || l.canal_nome)}</span>}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2"><Badge tone={loadStatusTone(String(l.status ?? ''))} dot>{String(l.status ?? '-')}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Precisa de atenção" />
            <CardBody className="py-1">
              {alerts.length === 0 ? (
                <EmptyState icon={PackageCheck} title="Tudo em dia" description="Nenhum alerta pendente no momento." />
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {alerts.map((a) => (
                    <li key={a.label}>
                      <Link href={a.href} className="-mx-2 flex items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-zinc-50">
                        <span className="flex items-center gap-2 text-zinc-700">
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                          {a.label}
                        </span>
                        <span className="font-semibold text-zinc-900">{a.count}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {canSeeFinancial && (
            <Card>
              <CardHeader title="Financeiro do mês" />
              <CardBody className="space-y-2.5 text-sm">
                <div className="flex justify-between"><span className="text-zinc-500">Faturamento</span><span className="font-medium">{money(cards.fat)}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">CMV total</span><span className="font-medium">{money(cards.cmv)}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Custo de frete</span><span className="font-medium">{money(cards.frete)}</span></div>
                <div className="flex justify-between border-t border-zinc-100 pt-2.5"><span className="text-zinc-500">Margem</span><span className={cards.margem >= 0 ? 'font-semibold text-emerald-700' : 'font-semibold text-rose-700'}>{money(cards.margem)}</span></div>
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      <Link href="/relatorios" className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700">
        Ver relatórios detalhados por empresa, marketplace, loja e fornecedor
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
