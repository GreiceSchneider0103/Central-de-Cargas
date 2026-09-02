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
    .select('id,tabela,registro_id,acao,created_at,profile_id,payload,users_profile(nome,email,perfil)', { count: 'exact' })
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
                    <th className="px-4 py-2.5">Payload</th>
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
                        <td className="px-4 py-2.5">
                          <pre className="max-w-[420px] whitespace-pre-wrap text-[10px] text-zinc-500">{JSON.stringify((r.payload ?? {}) as unknown, null, 2)}</pre>
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
