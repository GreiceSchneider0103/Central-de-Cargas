import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Download, Package2, AlertTriangle, CheckCircle2, DollarSign } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import type { UserProfile } from '@/lib/auth/roles';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { StatCard } from '@/components/ui/StatCard';

type LoadRow = {
  id: string;
  codigo_interno: string;
  tipo: string;
  status: string;
  data_agendada: string | null;
  empresa_id: string | null;
  marketplace_id: string | null;
  loja_destino_id: string | null;
  fornecedores?: string | null;
  custo_frete?: number | null;
  faturamento_estimado?: number | null;
  cmv_total?: number | null;
  margem_estimativa_valor?: number | null;
};

function canViewFinancial(role: string) {
  return ['admin', 'gerente_estoque', 'financeiro', 'gerente_ecommerce'].includes(role);
}

function parseMonth(value: string | undefined) {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})$/.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  if (month < 0 || month > 11) return null;
  return { year, month };
}

function monthKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function money(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams?: Promise<{ month?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/login');

  const { data: profile } = await supabase
    .from('users_profile')
    .select('*')
    .eq('auth_user_id', userData.user.id)
    .single<UserProfile>();
  if (!profile) redirect('/');

  const now = new Date();
  const selected = parseMonth(sp?.month) ?? {
    year: now.getFullYear(),
    month: now.getMonth(),
  };
  const from = new Date(selected.year, selected.month, 1);
  const to = new Date(selected.year, selected.month + 1, 1);
  const fromIso = from.toISOString();
  const toIso = to.toISOString();

  const financialAllowed = canViewFinancial(profile.perfil);

  const [loadsRes, companiesRes, channelsRes, storesRes] = await Promise.all([
    supabase.rpc('get_visible_loads_enriched_range', {
      p_from: fromIso,
      p_to: toIso,
      p_limit: 2000,
    }),
    supabase.from('companies').select('id,nome').order('nome').limit(200),
    supabase.from('channels').select('id,nome').order('nome').limit(200),
    supabase.from('stores').select('id,nome').order('nome').limit(500),
  ]);

  const loads = (loadsRes.data ?? []) as unknown as LoadRow[];

  const companyById = new Map((companiesRes.data ?? []).map((r) => [r.id, r.nome] as const));
  const channelById = new Map((channelsRes.data ?? []).map((r) => [r.id, r.nome] as const));
  const storeById = new Map((storesRes.data ?? []).map((r) => [r.id, r.nome] as const));

  const byStatus = new Map<string, number>();
  const byCompany = new Map<string, number>();
  const byMarketplace = new Map<string, number>();
  const byStore = new Map<string, number>();
  const bySupplier = new Map<string, number>();

  let overdue = 0;
  let finalized = 0;

  let sumFreight = 0;
  let sumCmv = 0;
  let sumRevenue = 0;
  let sumMargin = 0;

  const nowTs = now.getTime();
  for (const l of loads) {
    byStatus.set(l.status, (byStatus.get(l.status) ?? 0) + 1);
    if (l.empresa_id) byCompany.set(l.empresa_id, (byCompany.get(l.empresa_id) ?? 0) + 1);
    if (l.marketplace_id) byMarketplace.set(l.marketplace_id, (byMarketplace.get(l.marketplace_id) ?? 0) + 1);
    if (l.loja_destino_id) byStore.set(l.loja_destino_id, (byStore.get(l.loja_destino_id) ?? 0) + 1);

    if (l.data_agendada) {
      const ag = new Date(l.data_agendada).getTime();
      if (ag < nowTs && !['Finalizada', 'Cancelada', 'Entregue'].includes(l.status)) overdue += 1;
    }
    if (l.status === 'Finalizada') finalized += 1;

    const suppliers = (l.fornecedores ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const s of suppliers) bySupplier.set(s, (bySupplier.get(s) ?? 0) + 1);

    if (financialAllowed) {
      if (typeof l.custo_frete === 'number') sumFreight += l.custo_frete;
      if (typeof l.cmv_total === 'number') sumCmv += l.cmv_total;
      if (typeof l.faturamento_estimado === 'number') sumRevenue += l.faturamento_estimado;
      if (typeof l.margem_estimativa_valor === 'number') sumMargin += l.margem_estimativa_valor;
    }
  }

  const monthOptions = Array.from({ length: 12 }).map((_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return monthKey(d);
  });

  function mapToRows(map: Map<string, number>, resolveName: (id: string) => string) {
    return Array.from(map.entries())
      .map(([id, count]) => ({ id, name: resolveName(id), count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }

  const rowsStatus = mapToRows(byStatus, (s) => s);
  const rowsCompany = mapToRows(byCompany, (id) => companyById.get(id) ?? id);
  const rowsMarketplace = mapToRows(byMarketplace, (id) => channelById.get(id) ?? id);
  const rowsStore = mapToRows(byStore, (id) => storeById.get(id) ?? id);
  const rowsSupplier = mapToRows(bySupplier, (name) => name);

  const exportHref = `/api/reports/loads/export?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(
    toIso,
  )}`;

  const limited = loads.length >= 2000;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Relatórios</h1>
          <p className="text-sm text-zinc-500">Agregações por período (o escopo respeita as permissões do seu perfil).</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <form className="flex items-center gap-2" action="/relatorios" method="get">
            <Select name="month" defaultValue={monthKey(from)} className="w-36">
              {monthOptions.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </Select>
            <Button type="submit" variant="secondary">Aplicar</Button>
          </form>

          <Link href={exportHref}>
            <Button variant="primary">
              <Download className="h-4 w-4" />
              Exportar CSV
            </Button>
          </Link>
        </div>
      </div>

      {limited && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Resultado limitado a 2000 cargas neste mês. Ajuste o período se necessário.
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <StatCard label="Cargas no mês" value={loads.length} icon={Package2} tone="brand" />
        <StatCard label="Cargas atrasadas" value={overdue} icon={AlertTriangle} tone="danger" />
        <StatCard label="Cargas finalizadas" value={finalized} icon={CheckCircle2} tone="success" />
        {financialAllowed ? (
          <StatCard label="Margem do mês" value={money(sumMargin)} icon={DollarSign} tone={sumMargin >= 0 ? 'success' : 'danger'} hint={`Faturamento ${money(sumRevenue)}`} />
        ) : (
          <StatCard label="Financeiro" value="Restrito" icon={DollarSign} tone="neutral" />
        )}
      </div>

      {financialAllowed && (
        <Card>
          <CardBody className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <div><div className="text-xs text-zinc-500">Faturamento</div><div className="font-semibold">{money(sumRevenue)}</div></div>
            <div><div className="text-xs text-zinc-500">CMV</div><div className="font-semibold">{money(sumCmv)}</div></div>
            <div><div className="text-xs text-zinc-500">Frete</div><div className="font-semibold">{money(sumFreight)}</div></div>
            <div><div className="text-xs text-zinc-500">Margem</div><div className={`font-semibold ${sumMargin >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{money(sumMargin)}</div></div>
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ReportTable title="Cargas por status" rows={rowsStatus} />
        <ReportTable title="Cargas por empresa" rows={rowsCompany} />
        <ReportTable title="Cargas por marketplace" rows={rowsMarketplace} />
        <ReportTable title="Cargas por loja" rows={rowsStore} />
        <ReportTable title="Cargas por fornecedor" rows={rowsSupplier} />
      </div>
    </div>
  );
}

function ReportTable({
  title,
  rows,
}: {
  title: string;
  rows: { id: string; name: string; count: number }[];
}) {
  return (
    <Card>
      <CardHeader title={title} />
      <CardBody className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[360px] text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-left text-xs font-medium text-zinc-500">
                <th className="px-4 py-2">Nome</th>
                <th className="px-4 py-2 text-right">Qtd.</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 50).map((r) => (
                <tr key={r.id} className="border-b border-zinc-50 last:border-0">
                  <td className="px-4 py-2">{r.name}</td>
                  <td className="px-4 py-2 text-right font-medium">{r.count}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-center text-zinc-400" colSpan={2}>Sem dados no período.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {rows.length > 50 && <p className="px-4 py-2 text-xs text-zinc-500">Mostrando top 50.</p>}
      </CardBody>
    </Card>
  );
}
