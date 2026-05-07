-- P1 hardening: transactional conversion RPC, stricter audit policies, and load finalization RPC

create or replace function public.convert_load_request_to_load(p_request_id uuid)
returns table(load_id uuid, codigo_interno text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_profile public.users_profile%rowtype;
  v_request public.load_requests%rowtype;
  v_has_items boolean;
  v_new_load_id uuid;
  v_new_code text;
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

  if v_profile.perfil not in ('admin', 'gerente_estoque') then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  select * into v_request
  from public.load_requests
  where id = p_request_id
  for update;

  if v_request.id is null then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_request.status <> 'Aprovada' then
    raise exception 'REQUEST_NOT_APPROVED' using errcode = 'P0001';
  end if;

  if v_request.carga_id is not null then
    raise exception 'ALREADY_CONVERTED' using errcode = 'P0001';
  end if;

  select exists(select 1 from public.load_request_items where request_id = p_request_id) into v_has_items;
  if not v_has_items then
    raise exception 'REQUEST_WITHOUT_ITEMS' using errcode = 'P0001';
  end if;

  insert into public.loads (
    tipo, empresa_id, canal_id, marketplace_id, destino_full_id, loja_destino_id,
    prioridade, solicitante_id, observacoes, status
  ) values (
    v_request.tipo, v_request.empresa_id, v_request.canal_id, v_request.marketplace_id, v_request.destino_full_id, v_request.loja_destino_id,
    v_request.prioridade, v_request.solicitante_id, v_request.observacoes, 'Aprovada'
  ) returning id, codigo_interno into v_new_load_id, v_new_code;

  insert into public.load_items (
    load_id, product_id, sku, nome_produto, quantidade, fornecedor_origem_id, cmv_unitario, cmv_total, data_prevista_recebimento, observacao
  )
  select
    v_new_load_id, product_id, sku, nome_produto, quantidade, fornecedor_origem_id, cmv_unitario, cmv_total, data_prevista_recebimento, observacao
  from public.load_request_items
  where request_id = p_request_id;

  insert into public.load_checklists(load_id) values (v_new_load_id);

  update public.load_requests
  set status = 'Transformada em carga',
      carga_id = v_new_load_id
  where id = p_request_id;

  insert into public.load_request_history(request_id, acao, status_anterior, status_novo, observacao, autor_profile_id)
  values (p_request_id, 'request_converted_to_load', 'Aprovada', 'Transformada em carga', 'load_id:' || v_new_load_id::text, v_profile.id);

  insert into public.audit_logs(tabela, registro_id, acao, payload, profile_id)
  values (
    'load_requests',
    p_request_id,
    'REQUEST_CONVERTED_TO_LOAD',
    jsonb_build_object('request_id', p_request_id, 'load_id', v_new_load_id, 'codigo_interno', v_new_code),
    v_profile.id
  );

  return query select v_new_load_id, v_new_code;
end;
$$;

revoke all on function public.convert_load_request_to_load(uuid) from public;
grant execute on function public.convert_load_request_to_load(uuid) to authenticated;

drop policy if exists "audit_logs_insert" on public.audit_logs;
drop policy if exists "audit_logs_update" on public.audit_logs;
drop policy if exists "audit_logs_delete" on public.audit_logs;

create policy "audit_logs_select" on public.audit_logs
for select
using (public.has_role(array['admin','gerente_estoque','financeiro']));

create policy "audit_logs_insert" on public.audit_logs
for insert
with check (
  public.has_role(array['admin','gerente_estoque'])
  and profile_id = public.current_profile_id()
);

create or replace function public.finalize_load_with_checklist(p_load_id uuid)
returns table(load_id uuid, warning text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_profile public.users_profile%rowtype;
  v_load public.loads%rowtype;
  v_checklist public.load_checklists%rowtype;
  v_warning text;
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

  select * into v_load from public.loads where id = p_load_id for update;
  if v_load.id is null then
    raise exception 'LOAD_NOT_FOUND' using errcode = 'P0001';
  end if;

  if not (
    v_profile.perfil in ('admin','gerente_estoque')
    or (v_profile.perfil = 'gerente_ecommerce' and v_load.tipo = 'FULL_MARKETPLACE')
  ) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  if v_load.status = 'Cancelada' then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;

  select * into v_checklist from public.load_checklists where load_id = p_load_id for update;

  update public.loads set status = 'Finalizada' where id = p_load_id;

  if v_checklist.id is null then
    insert into public.load_checklists(load_id, finalizada) values (p_load_id, true) returning * into v_checklist;
  else
    update public.load_checklists set finalizada = true where id = v_checklist.id;
  end if;

  if coalesce(v_checklist.nf_emitida, false) = false then
    v_warning := 'NF_NOT_EMITTED';
  else
    v_warning := null;
  end if;

  insert into public.audit_logs(tabela, registro_id, acao, payload, profile_id)
  values ('loads', p_load_id, 'LOAD_FINALIZED', jsonb_build_object('previous_status', v_load.status, 'new_status', 'Finalizada', 'warning', v_warning), v_profile.id);

  return query select p_load_id, v_warning;
end;
$$;

revoke all on function public.finalize_load_with_checklist(uuid) from public;
grant execute on function public.finalize_load_with_checklist(uuid) to authenticated;
