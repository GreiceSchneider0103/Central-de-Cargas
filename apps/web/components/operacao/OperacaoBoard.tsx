'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { UserProfile } from '@/lib/auth/roles';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';
import { loadStatusTone, priorityTone } from '@/lib/ui/status-styles';
import { translateError } from '@/lib/ui/error-messages';

type OpLoad = {
  id: string;
  codigo_interno: string | null;
  tipo: string;
  status: string;
  prioridade: string | null;
  data_agendada: string | null;
  canal_nome: string | null;
  loja_nome: string | null;
  observacoes: string | null;
};
type ItemSummary = { itens: number; unidades: number; peso: number };
type Tab = 'hoje' | 'semana' | 'atrasadas' | 'sem_data';

// Passos da operação, na ordem. "Concluída" grava o status Finalizada.
const STEPS = [
  { status: 'Separando', label: 'Separando' },
  { status: 'Pronta para coleta', label: 'Pronta p/ coleta' },
  { status: 'Carregada', label: 'Carregada' },
  { status: 'Finalizada', label: 'Concluída' },
] as const;
const DONE = ['Finalizada', 'Entregue', 'Cancelada'];

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function OperacaoBoard({ profile }: { profile: UserProfile }) {
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();
  const canOperate = ['admin', 'gerente_estoque', 'operador_carga'].includes(profile.perfil);
  const [tab, setTab] = useState<Tab>('hoje');
  const [loads, setLoads] = useState<OpLoad[]>([]);
  const [noDate, setNoDate] = useState<OpLoad[]>([]);
  const [summary, setSummary] = useState<Record<string, ItemSummary>>({});
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<{ load: OpLoad; status: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const from = addDays(startOfDay(new Date()), -60);
    const to = addDays(startOfDay(new Date()), 15);
    const [ranged, undated] = await Promise.all([
      supabase.rpc('get_visible_loads_enriched_range', { p_from: from.toISOString(), p_to: to.toISOString(), p_limit: 2000 }),
      supabase
        .from('loads')
        .select('id,codigo_interno,tipo,status,prioridade,data_agendada,observacoes')
        .is('data_agendada', null)
        .not('status', 'in', `(${DONE.map((s) => `"${s}"`).join(',')})`)
        .order('created_at', { ascending: false })
        .limit(200),
    ]);
    if (ranged.error) toast.error(translateError(ranged.error.message, 'Erro ao carregar as cargas.'));
    const rangedLoads = ((ranged.data ?? []) as OpLoad[]).filter((l) => l.status !== 'Cancelada');
    const undatedLoads = ((undated.data ?? []) as OpLoad[]).map((l) => ({ ...l, canal_nome: null, loja_nome: null }));
    setLoads(rangedLoads);
    setNoDate(undatedLoads);

    const ids = [...rangedLoads, ...undatedLoads].map((l) => l.id);
    if (ids.length > 0) {
      const { data: items } = await supabase.from('load_items').select('load_id,quantidade,peso').in('load_id', ids);
      const acc: Record<string, ItemSummary> = {};
      for (const i of (items ?? []) as { load_id: string; quantidade: number | null; peso: number | null }[]) {
        const s = (acc[i.load_id] ??= { itens: 0, unidades: 0, peso: 0 });
        s.itens += 1;
        s.unidades += Number(i.quantidade ?? 0);
        s.peso += Number(i.peso ?? 0) * Number(i.quantidade ?? 0);
      }
      setSummary(acc);
    } else {
      setSummary({});
    }
    setLoading(false);
  }, [supabase, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const byTab = useMemo(() => {
    const today = startOfDay(new Date());
    const tomorrow = addDays(today, 1);
    const weekEnd = addDays(today, 7);
    const at = (l: OpLoad) => (l.data_agendada ? new Date(l.data_agendada) : null);
    const sortByDate = (a: OpLoad, b: OpLoad) => (at(a)?.getTime() ?? 0) - (at(b)?.getTime() ?? 0);
    return {
      hoje: loads.filter((l) => { const d = at(l); return d && d >= today && d < tomorrow; }).sort(sortByDate),
      semana: loads.filter((l) => { const d = at(l); return d && d >= today && d < weekEnd; }).sort(sortByDate),
      atrasadas: loads.filter((l) => { const d = at(l); return d && d < today && !DONE.includes(l.status); }).sort(sortByDate),
      sem_data: noDate,
    } satisfies Record<Tab, OpLoad[]>;
  }, [loads, noDate]);

  async function applyStatus() {
    if (!pending) return;
    setSaving(true);
    const { error } = await supabase.rpc('set_load_operational_status_from_checklist', { p_load_id: pending.load.id, p_status: pending.status });
    setSaving(false);
    if (error) return toast.error(translateError(error.message, 'Não foi possível atualizar a carga.'));
    toast.success(`${pending.load.codigo_interno ?? 'Carga'} marcada como "${pending.status === 'Finalizada' ? 'Concluída' : pending.status}".`);
    setPending(null);
    await fetchData();
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'hoje', label: 'Hoje' },
    { key: 'semana', label: 'Próximos 7 dias' },
    { key: 'atrasadas', label: 'Atrasadas' },
    { key: 'sem_data', label: 'Sem data' },
  ];
  const list = byTab[tab];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={cn('rounded-full px-3 py-1.5 text-sm font-medium', tab === t.key ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200')}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            <span className={cn('ml-1.5 rounded-full px-1.5 text-xs', tab === t.key ? 'bg-white/20' : 'bg-white', t.key === 'atrasadas' && byTab.atrasadas.length > 0 && tab !== t.key && 'text-rose-600')}>
              {byTab[t.key].length}
            </span>
          </button>
        ))}
        <Button variant="ghost" size="sm" className="ml-auto" onClick={fetchData} disabled={loading}>
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Atualizar
        </Button>
      </div>

      {loading ? (
        <Card><CardBody><SkeletonRows rows={5} /></CardBody></Card>
      ) : list.length === 0 ? (
        <Card><CardBody><EmptyState title="Nenhuma carga aqui" description="Quando houver cargas agendadas para este período, elas aparecem nesta lista." /></CardBody></Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {list.map((l) => {
            const s = summary[l.id];
            const destino = l.tipo === 'FULL_MARKETPLACE' ? `Full · ${l.canal_nome ?? ''}` : `Loja · ${l.loja_nome ?? ''}`;
            const done = DONE.includes(l.status);
            return (
              <Card key={l.id} className={cn(done && 'opacity-70')}>
                <CardBody className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <Link href={`/cargas/${l.id}`} className="text-base font-semibold text-brand-700 hover:underline">{l.codigo_interno ?? 'Carga'}</Link>
                      <p className="text-sm text-zinc-600">{destino}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {l.prioridade && <Badge tone={priorityTone(l.prioridade)}>{l.prioridade}</Badge>}
                      <Badge tone={loadStatusTone(l.status)} dot>{l.status === 'Finalizada' ? 'Concluída' : l.status}</Badge>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-600">
                    <span>{l.data_agendada ? new Date(l.data_agendada).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Sem data agendada'}</span>
                    {s && <span>{s.itens} itens · {s.unidades.toLocaleString('pt-BR')} un.</span>}
                    {s && s.peso > 0 && <span>{s.peso.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg</span>}
                  </div>
                  {l.observacoes && <p className="text-xs text-zinc-500">{l.observacoes}</p>}
                  {canOperate && !done && (
                    <div className="flex flex-wrap gap-2 border-t border-zinc-100 pt-3">
                      {STEPS.map((step) => (
                        <Button
                          key={step.status}
                          size="sm"
                          variant={step.status === 'Finalizada' ? 'primary' : 'secondary'}
                          disabled={l.status === step.status}
                          onClick={() => setPending({ load: l, status: step.status })}
                        >
                          {step.label}
                        </Button>
                      ))}
                    </div>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={!!pending}
        onClose={() => !saving && setPending(null)}
        title="Atualizar carga"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPending(null)} disabled={saving}>Cancelar</Button>
            <Button variant="primary" onClick={applyStatus} disabled={saving}>{saving ? 'Salvando...' : 'Confirmar'}</Button>
          </>
        }
      >
        <p className="text-sm text-zinc-600">
          Marcar <strong>{pending?.load.codigo_interno}</strong> como <strong>{pending?.status === 'Finalizada' ? 'Concluída' : pending?.status}</strong>?
        </p>
      </Dialog>
    </div>
  );
}
