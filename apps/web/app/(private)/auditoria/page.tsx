import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { UserProfile } from '@/lib/auth/roles';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, FieldGroup } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/EmptyState';

const PAGE_SIZE = 50;

function parseDate(value: string | undefined) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const FIELD_LABELS: Record<string, string> = {
  status: 'Status',
  custo_frete: 'Custo de frete',
  outros_custos: 'Outros custos',
  faturamento_estimado: 'Faturamento estimado',
  cmv_unitario: 'CMV unitário',
  quantidade: 'Quantidade',
  data_agendada: 'Data agendada',
  data_prevista_recebimento: 'Previsão de recebimento',
  data_real_recebimento: 'Recebimento real',
  responsavel_operacional_id: 'Responsável',
  transportador_id: 'Transportador',
  sku: 'SKU',
  texto: 'Texto',
};

const PAYLOAD_KEY_LABELS: Record<string, string> = {
  codigo_interno: 'Código',
  tipo: 'Tipo',
  items_count: 'Itens',
  previous_status: 'Status anterior',
  new_status: 'Novo status',
  warning: 'Aviso',
  request_id: 'Solicitação',
  load_id: 'Carga',
  sku: 'SKU',
  entidade: 'Entidade',
  entidade_id: 'ID',
};

function formatValue(value: unknown) {
  return value == null || value === '' ? '—' : String(value);
}

function AuditDetail({ fieldName, oldValue, newValue, payload }: { fieldName: string | null; oldValue: string | null; newValue: string | null; payload: unknown }) {
  if (fieldName) {
    return (
      <div className="text-xs text-zinc-700">
        <span className="font-medium">{FIELD_LABELS[fieldName] ?? fieldName}</span>
        {(oldValue != null || newValue != null) && (
          <div className="mt-0.5 text-zinc-500">
            {formatValue(oldValue)} → {formatValue(newValue)}
          </div>
        )}
      </div>
    );
  }

  const entries = payload && typeof payload === 'object' ? Object.entries(payload as Record<string, unknown>) : [];
  if (entries.length === 0) return <span className="text-xs text-zinc-400">—</span>;

  return (
    <dl className="space-y-0.5 text-xs text-zinc-600">
      {entries.map(([key, value]) => (
        <div key={key} className="flex gap-1">
          <dt className="font-medium text-zinc-700">{PAYLOAD_KEY_LABELS[key] ?? key}:</dt>
          <dd>{formatValue(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams?: Promise<{
    tabela?: string;
    registro_id?: string;
    profile_id?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
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

  const allowed = ['admin', 'gerente_estoque', 'financeiro'].includes(profile.perfil);
  if (!allowed) redirect('/');

  const from = parseDate(sp?.from);
  const to = parseDate(sp?.to);
  const currentPage = Math.max(1, Number(sp?.page ?? '1') || 1);

  let q = supabase
    .from('audit_logs')
    .select('id,tabela,registro_id,acao,created_at,profile_id,payload,field_name,old_value,new_value,users_profile(nome,email,perfil)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE - 1);

  if (sp?.tabela) q = q.eq('tabela', sp.tabela);
  if (sp?.registro_id) q = q.eq('registro_id', sp.registro_id);
  if (sp?.profile_id) q = q.eq('profile_id', sp.profile_id);
  if (from) q = q.gte('created_at', from.toISOString());
  if (to) q = q.lt('created_at', to.toISOString());

  const { data: rows, error, count } = await q;

  const totalRows = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const filterQuery = new URLSearchParams();
  if (sp?.tabela) filterQuery.set('tabela', sp.tabela);
  if (sp?.registro_id) filterQuery.set('registro_id', sp.registro_id);
  if (sp?.profile_id) filterQuery.set('profile_id', sp.profile_id);
  if (sp?.from) filterQuery.set('from', sp.from);
  if (sp?.to) filterQuery.set('to', sp.to);
  function pagedHref(page: number) {
    const params = new URLSearchParams(filterQuery);
    params.set('page', String(page));
    return `/auditoria?${params.toString()}`;
  }

  type AuditRow = {
    id: string;
    tabela: string;
    registro_id: string | null;
    acao: string;
    created_at: string;
    profile_id: string | null;
    payload: unknown;
    field_name: string | null;
    old_value: string | null;
    new_value: string | null;
    users_profile?: { nome: string | null; email: string | null; perfil: string | null }[] | null;
  };

  const typedRows = (rows ?? []) as unknown as AuditRow[];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Auditoria</h1>
        <p className="text-sm text-zinc-500">{totalRows} evento{totalRows === 1 ? '' : 's'}, restrito por perfil.</p>
      </div>

      <Card>
        <CardBody>
          <form className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end" action="/auditoria" method="get">
            <FieldGroup label="Tabela">
              <Input name="tabela" defaultValue={sp?.tabela ?? ''} placeholder="loads / load_requests ..." className="w-44" />
            </FieldGroup>
            <FieldGroup label="Registro ID">
              <Input name="registro_id" defaultValue={sp?.registro_id ?? ''} placeholder="uuid" className="w-48" />
            </FieldGroup>
            <FieldGroup label="Usuário (profile_id)">
              <Input name="profile_id" defaultValue={sp?.profile_id ?? ''} placeholder="uuid" className="w-48" />
            </FieldGroup>
            <FieldGroup label="De">
              <Input name="from" type="date" defaultValue={sp?.from ?? ''} className="w-40" />
            </FieldGroup>
            <FieldGroup label="Até">
              <Input name="to" type="date" defaultValue={sp?.to ?? ''} className="w-40" />
            </FieldGroup>
            <Button type="submit" variant="primary">Filtrar</Button>
          </form>
        </CardBody>
      </Card>

      {error && <p className="text-sm text-rose-600">{error.message}</p>}

      <Card>
        <CardBody className="p-0">
          {typedRows.length === 0 ? (
            <EmptyState title="Sem resultados" description="Ajuste os filtros acima para encontrar eventos de auditoria." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-left text-xs font-medium text-zinc-500">
                    <th className="px-4 py-2.5">Data/Hora</th>
                    <th className="px-4 py-2.5">Tabela</th>
                    <th className="px-4 py-2.5">Registro</th>
                    <th className="px-4 py-2.5">Ação</th>
                    <th className="px-4 py-2.5">Usuário</th>
                    <th className="px-4 py-2.5">Detalhe</th>
                  </tr>
                </thead>
                <tbody>
                  {typedRows.map((r) => {
                    const up = Array.isArray(r.users_profile) ? r.users_profile[0] : null;
                    return (
                      <tr key={r.id} className="border-b border-zinc-50 align-top last:border-0">
                        <td className="whitespace-nowrap px-4 py-2.5 text-zinc-600">{new Date(r.created_at).toLocaleString('pt-BR')}</td>
                        <td className="px-4 py-2.5 text-zinc-600">{r.tabela}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-zinc-500">{r.registro_id ?? '-'}</td>
                        <td className="px-4 py-2.5 font-medium text-zinc-800">{r.acao}</td>
                        <td className="px-4 py-2.5">
                          <div className="text-xs text-zinc-700">{(up?.nome || up?.email || r.profile_id) ?? '-'}</div>
                          {up?.perfil && <div className="text-[10px] text-zinc-500">{up.perfil}</div>}
                        </td>
                        <td className="max-w-[320px] px-4 py-2.5">
                          <AuditDetail fieldName={r.field_name} oldValue={r.old_value} newValue={r.new_value} payload={r.payload} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {totalRows > 0 && (
        <div className="flex items-center justify-between text-sm">
          <Link
            className={`rounded-lg border border-zinc-300 bg-white px-3 py-1.5 font-medium text-zinc-700 hover:bg-zinc-50 ${currentPage === 1 ? 'pointer-events-none opacity-50' : ''}`}
            href={pagedHref(Math.max(1, currentPage - 1))}
          >
            Anterior
          </Link>
          <span className="text-zinc-500">Página {currentPage} de {totalPages} ({totalRows} eventos)</span>
          <Link
            className={`rounded-lg border border-zinc-300 bg-white px-3 py-1.5 font-medium text-zinc-700 hover:bg-zinc-50 ${currentPage >= totalPages ? 'pointer-events-none opacity-50' : ''}`}
            href={pagedHref(currentPage + 1)}
          >
            Próxima
          </Link>
        </div>
      )}
    </div>
  );
}
