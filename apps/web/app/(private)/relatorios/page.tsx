import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { UserProfile } from '@/lib/auth/roles';

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
          <h1 className="text-2xl font-bold">Relatórios</h1>
          <p className="text-zinc-600">Agregações simples para homologação (escopo respeita permissões).</p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <form className="flex gap-2 items-center" action="/relatorios" method="get">
            <label className="text-sm text-zinc-600">Mês</label>
            <select name="month" defaultValue={monthKey(from)} className="h-9 border rounded px-2">
              {monthOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <button className="h-9 px-3 border rounded">Aplicar</button>
          </form>

          <Link className="h-9 px-3 rounded bg-indigo-600 text-white flex items-center" href={exportHref}>
            Exportar CSV
          </Link>
        </div>
      </div>

      {limited && (
        <div className="border rounded bg-amber-50 text-amber-900 p-3 text-sm">
          Resultado limitado a 2000 cargas neste mês. Ajuste o período se necessário.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-white border rounded p-4">
          <div className="text-sm text-zinc-500">Cargas no mês</div>
          <div className="text-2xl font-bold">{loads.length}</div>
        </div>
        <div className="bg-white border rounded p-4">
          <div className="text-sm text-zinc-500">Cargas atrasadas</div>
          <div className="text-2xl font-bold">{overdue}</div>
        </div>
        <div className="bg-white border rounded p-4">
          <div className="text-sm text-zinc-500">Cargas finalizadas</div>
          <div className="text-2xl font-bold">{finalized}</div>
        </div>
        <div className="bg-white border rounded p-4">
          <div className="text-sm text-zinc-500">Financeiro (mês)</div>
          {financialAllowed ? (
            <div className="text-xs text-zinc-700 space-y-1 mt-1">
              <div>Faturamento: {sumRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
              <div>CMV: {sumCmv.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
              <div>Frete: {sumFreight.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
              <div>Margem: {sumMargin.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
            </div>
          ) : (
            <div className="text-sm text-zinc-400 mt-1">Restrito por perfil</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
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
    <div className="bg-white border rounded p-4">
      <h2 className="font-semibold mb-3">{title}</h2>
      <div className="overflow-x-auto">
        <table className="min-w-[360px] w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2">Nome</th>
              <th className="py-2 text-right">Qtd.</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 50).map((r) => (
              <tr key={r.id} className="border-b">
                <td className="py-2">{r.name}</td>
                <td className="py-2 text-right">{r.count}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="py-3 text-zinc-500" colSpan={2}>
                  Sem dados no período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {rows.length > 50 && <p className="text-xs text-zinc-500 mt-2">Mostrando top 50.</p>}
    </div>
  );
}
