-- Reaplica convert_load_request_to_load na versão de 20260902130000, que no
-- projeto snhyqpxaichererhcuvz ficou com a versão antiga (não copiava
-- faturamento_estimado da solicitação para a carga). Inclui
-- #variable_conflict use_column, como nas correções de 20260916194558/194706,
-- porque os parâmetros OUT (load_id, codigo_interno) colidem com colunas.

create or replace function public.convert_load_request_to_load(p_request_id uuid)
returns table(load_id uuid, codigo_interno text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
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
    prioridade, solicitante_id, observacoes, status, faturamento_estimado
  ) values (
    v_request.tipo, v_request.empresa_id, v_request.canal_id, v_request.marketplace_id, v_request.destino_full_id, v_request.loja_destino_id,
    v_request.prioridade, v_request.solicitante_id, v_request.observacoes, 'Aprovada', v_request.faturamento_estimado
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
