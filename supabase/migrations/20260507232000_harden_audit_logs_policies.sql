-- Harden audit_logs policies and provide safe audit writer RPC

alter table public.audit_logs enable row level security;

drop policy if exists "audit_logs_select" on public.audit_logs;
drop policy if exists "audit_logs_insert" on public.audit_logs;
drop policy if exists "audit_logs_update" on public.audit_logs;
drop policy if exists "audit_logs_delete" on public.audit_logs;

create policy "audit_logs_select" on public.audit_logs
for select
using (public.has_role(array['admin','gerente_estoque','financeiro']));

-- block direct client inserts/updates/deletes
create policy "audit_logs_insert" on public.audit_logs
for insert
with check (false);

create or replace function public.write_audit_log_safe(
  p_tabela text,
  p_registro_id uuid,
  p_acao text,
  p_payload jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_profile public.users_profile%rowtype;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'UNAUTHORIZED' using errcode = 'P0001';
  end if;

  select * into v_profile
  from public.users_profile
  where auth_user_id = v_uid and ativo = true
  limit 1;

  if v_profile.id is null then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  if v_profile.perfil not in ('admin','gerente_estoque','operador_carga','financeiro','gerente_ecommerce') then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  insert into public.audit_logs(tabela, registro_id, acao, payload, profile_id)
  values (p_tabela, p_registro_id, p_acao, p_payload, v_profile.id);
end;
$$;

revoke all on function public.write_audit_log_safe(text, uuid, text, jsonb) from public;
grant execute on function public.write_audit_log_safe(text, uuid, text, jsonb) to authenticated;
