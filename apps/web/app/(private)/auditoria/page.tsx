import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { UserProfile } from '@/lib/auth/roles';

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

  let q = supabase
    .from('audit_logs')
    .select('id,tabela,registro_id,acao,created_at,profile_id,payload,users_profile(nome,email,perfil)')
    .order('created_at', { ascending: false })
    .limit(200);

  if (sp?.tabela) q = q.eq('tabela', sp.tabela);
  if (sp?.registro_id) q = q.eq('registro_id', sp.registro_id);
  if (sp?.profile_id) q = q.eq('profile_id', sp.profile_id);
  if (from) q = q.gte('created_at', from.toISOString());
  if (to) q = q.lt('created_at', to.toISOString());

  const { data: rows, error } = await q;

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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Auditoria</h1>
        <p className="text-zinc-600">Últimos 200 eventos (restrito por perfil).</p>
      </div>

      <form className="bg-white border rounded p-4 flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end" action="/auditoria" method="get">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Tabela</label>
          <input name="tabela" defaultValue={sp?.tabela ?? ''} className="h-9 border rounded px-2" placeholder="loads / load_requests ..." />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Registro ID</label>
          <input name="registro_id" defaultValue={sp?.registro_id ?? ''} className="h-9 border rounded px-2" placeholder="uuid" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Usuário (profile_id)</label>
          <input name="profile_id" defaultValue={sp?.profile_id ?? ''} className="h-9 border rounded px-2" placeholder="uuid" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">De</label>
          <input name="from" type="date" defaultValue={sp?.from ?? ''} className="h-9 border rounded px-2" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Até</label>
          <input name="to" type="date" defaultValue={sp?.to ?? ''} className="h-9 border rounded px-2" />
        </div>
        <button className="h-9 px-3 border rounded">Filtrar</button>
      </form>

      {error && <p className="text-sm text-rose-600">{error.message}</p>}

      <div className="bg-white border rounded p-4">
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2">Data/Hora</th>
                <th className="py-2">Tabela</th>
                <th className="py-2">Registro</th>
                <th className="py-2">Ação</th>
                <th className="py-2">Usuário</th>
                <th className="py-2">Payload</th>
              </tr>
            </thead>
            <tbody>
              {((rows ?? []) as unknown as AuditRow[]).map((r) => {
                const up = Array.isArray(r.users_profile) ? r.users_profile[0] : null;
                return (
                <tr key={r.id} className="border-b align-top">
                  <td className="py-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString('pt-BR')}</td>
                  <td className="py-2">{r.tabela}</td>
                  <td className="py-2 font-mono text-xs">{r.registro_id ?? '-'}</td>
                  <td className="py-2">{r.acao}</td>
                  <td className="py-2">
                    <div className="text-xs text-zinc-700">
                      {(up?.nome || up?.email || r.profile_id) ?? '-'}
                    </div>
                    {up?.perfil && <div className="text-[10px] text-zinc-500">{up.perfil}</div>}
                  </td>
                  <td className="py-2">
                    <pre className="text-[10px] whitespace-pre-wrap max-w-[520px]">{JSON.stringify((r.payload ?? {}) as unknown, null, 2)}</pre>
                  </td>
                </tr>
                );
              })}
              {(rows ?? []).length === 0 && (
                <tr>
                  <td className="py-3 text-zinc-500" colSpan={6}>
                    Sem resultados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
