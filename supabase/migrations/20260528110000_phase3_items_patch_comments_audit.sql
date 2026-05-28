-- Phase 3: safe item maintenance, partial load patching, comments and detailed audit fields.

alter table public.audit_logs add column if not exists entity_type text;
alter table public.audit_logs add column if not exists entity_id uuid;
alter table public.audit_logs add column if not exists user_id uuid;
alter table public.audit_logs add column if not exists action text;
alter table public.audit_logs add column if not exists field_name text;
alter table public.audit_logs add column if not exists old_value text;
alter table public.audit_logs add column if not exists new_value text;

create or replace function public.can_manage_load_record(p_load public.loads)
returns boolean
language sql
stable
as $$
  select case
    when public.has_role(array['admin','gerente_estoque']) then true
    when public.current_user_role() = 'gerente_ecommerce' then p_load.tipo = 'FULL_MARKETPLACE'
    else false
  end;
$$;

create or replace function public.write_audit_field_safe(
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_field_name text default null,
  p_old_value text default null,
  p_new_value text default null,
  p_payload jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.users_profile%rowtype;
begin
  select * into v_profile
  from public.users_profile
  where auth_user_id = auth.uid() and ativo = true
  limit 1;

  if v_profile.id is null then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  insert into public.audit_logs(
    tabela, registro_id, acao, payload, profile_id,
    entity_type, entity_id, user_id, action, field_name, old_value, new_value
  ) values (
    p_entity_type, p_entity_id, p_action, p_payload, v_profile.id,
    p_entity_type, p_entity_id, v_profile.id, p_action, p_field_name, p_old_value, p_new_value
  );
end;
$$;

revoke all on function public.write_audit_field_safe(text, uuid, text, text, text, text, jsonb) from public;
grant execute on function public.write_audit_field_safe(text, uuid, text, text, text, text, jsonb) to authenticated;

drop policy if exists "load_items_write" on public.load_items;
drop policy if exists "load_items_insert" on public.load_items;
drop policy if exists "load_items_update" on public.load_items;
drop policy if exists "load_items_delete" on public.load_items;
create policy "load_items_write" on public.load_items
for all
using (false)
with check (false);

create or replace function public.upsert_load_item_safe(
  p_load_id uuid,
  p_item_id uuid,
  p_item jsonb
)
returns table(item_id uuid, action text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.users_profile%rowtype;
  v_load public.loads%rowtype;
  v_existing public.load_items%rowtype;
  v_product public.products%rowtype;
  v_sku text;
  v_nome text;
  v_quantidade numeric;
  v_cmv numeric;
  v_fornecedor_id uuid;
  v_product_id uuid;
  v_action text;
  v_item_id uuid;
begin
  select * into v_profile from public.users_profile where auth_user_id = auth.uid() and ativo = true limit 1;
  if v_profile.id is null then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;

  select * into v_load from public.loads where id = p_load_id for update;
  if v_load.id is null then raise exception 'LOAD_NOT_FOUND' using errcode = 'P0001'; end if;
  if not public.can_manage_load_record(v_load) then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;

  v_sku := trim(coalesce(p_item->>'sku', ''));
  v_nome := trim(coalesce(p_item->>'nome_produto', ''));
  v_quantidade := nullif(p_item->>'quantidade', '')::numeric;
  v_fornecedor_id := nullif(p_item->>'fornecedor_origem_id', '')::uuid;
  v_product_id := nullif(p_item->>'product_id', '')::uuid;

  if v_sku = '' then raise exception 'ITEM_SKU_REQUIRED' using errcode = 'P0001'; end if;
  if v_quantidade is null or v_quantidade <= 0 then raise exception 'ITEM_QUANTITY_INVALID' using errcode = 'P0001'; end if;

  select * into v_product from public.products where sku = v_sku limit 1;
  if v_product.id is not null then
    v_product_id := v_product.id;
    if v_nome = '' then v_nome := v_product.nome; end if;
  end if;
  if v_nome = '' then raise exception 'ITEM_NAME_REQUIRED' using errcode = 'P0001'; end if;

  v_cmv := coalesce(nullif(p_item->>'cmv_unitario', '')::numeric, v_product.cmv, 0);
  if v_cmv < 0 then raise exception 'ITEM_CMV_INVALID' using errcode = 'P0001'; end if;

  if p_item_id is null then
    insert into public.load_items(
      load_id, product_id, sku, nome_produto, quantidade, fornecedor_origem_id, cmv_unitario,
      peso, altura, largura, profundidade, data_prevista_recebimento, data_real_recebimento, status_item, observacao
    ) values (
      p_load_id, v_product_id, v_sku, v_nome, v_quantidade, v_fornecedor_id, v_cmv,
      nullif(p_item->>'peso', '')::numeric, nullif(p_item->>'altura', '')::numeric, nullif(p_item->>'largura', '')::numeric,
      nullif(p_item->>'profundidade', '')::numeric, nullif(p_item->>'data_prevista_recebimento', '')::timestamptz,
      nullif(p_item->>'data_real_recebimento', '')::timestamptz, nullif(p_item->>'status_item', ''), nullif(p_item->>'observacao', '')
    ) returning id into v_item_id;
    v_action := 'LOAD_ITEM_CREATED';
  else
    select * into v_existing from public.load_items where id = p_item_id and load_id = p_load_id for update;
    if v_existing.id is null then raise exception 'ITEM_NOT_FOUND' using errcode = 'P0001'; end if;
    update public.load_items set
      product_id = v_product_id,
      sku = v_sku,
      nome_produto = v_nome,
      quantidade = v_quantidade,
      fornecedor_origem_id = v_fornecedor_id,
      cmv_unitario = v_cmv,
      peso = nullif(p_item->>'peso', '')::numeric,
      altura = nullif(p_item->>'altura', '')::numeric,
      largura = nullif(p_item->>'largura', '')::numeric,
      profundidade = nullif(p_item->>'profundidade', '')::numeric,
      data_prevista_recebimento = nullif(p_item->>'data_prevista_recebimento', '')::timestamptz,
      data_real_recebimento = nullif(p_item->>'data_real_recebimento', '')::timestamptz,
      status_item = nullif(p_item->>'status_item', ''),
      observacao = nullif(p_item->>'observacao', '')
    where id = p_item_id;
    v_item_id := p_item_id;
    v_action := 'LOAD_ITEM_UPDATED';
    perform public.write_audit_field_safe('load_items', p_item_id, 'ITEM_QUANTITY_CHANGED', 'quantidade', v_existing.quantidade::text, v_quantidade::text, null);
    perform public.write_audit_field_safe('load_items', p_item_id, 'ITEM_CMV_CHANGED', 'cmv_unitario', v_existing.cmv_unitario::text, v_cmv::text, null);
  end if;

  perform public.recalc_load_financial(p_load_id);
  perform public.write_audit_field_safe('load_items', v_item_id, v_action, null, null, null, jsonb_build_object('load_id', p_load_id, 'sku', v_sku));
  return query select v_item_id, v_action;
end;
$$;

revoke all on function public.upsert_load_item_safe(uuid, uuid, jsonb) from public;
grant execute on function public.upsert_load_item_safe(uuid, uuid, jsonb) to authenticated;

create or replace function public.delete_load_item_safe(p_load_id uuid, p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_load public.loads%rowtype;
  v_item public.load_items%rowtype;
  v_count int;
begin
  select * into v_load from public.loads where id = p_load_id for update;
  if v_load.id is null then raise exception 'LOAD_NOT_FOUND' using errcode = 'P0001'; end if;
  if not public.can_manage_load_record(v_load) then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;

  select count(*) into v_count from public.load_items where load_id = p_load_id;
  if v_count <= 1 then raise exception 'LOAD_ITEM_REQUIRED' using errcode = 'P0001'; end if;

  select * into v_item from public.load_items where id = p_item_id and load_id = p_load_id for update;
  if v_item.id is null then raise exception 'ITEM_NOT_FOUND' using errcode = 'P0001'; end if;

  delete from public.load_items where id = p_item_id;
  perform public.recalc_load_financial(p_load_id);
  perform public.write_audit_field_safe('load_items', p_item_id, 'LOAD_ITEM_DELETED', 'sku', v_item.sku, null, jsonb_build_object('load_id', p_load_id));
end;
$$;

revoke all on function public.delete_load_item_safe(uuid, uuid) from public;
grant execute on function public.delete_load_item_safe(uuid, uuid) to authenticated;

create or replace function public.patch_load_safe(p_load_id uuid, p_patch jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_load public.loads%rowtype;
  v_next_tipo text;
  v_financial_allowed boolean;
  v_new_status text;
  v_new_marketplace uuid;
  v_new_destino uuid;
  v_new_loja uuid;
  v_patch jsonb := p_patch;
begin
  select * into v_load from public.loads where id = p_load_id for update;
  if v_load.id is null then raise exception 'LOAD_NOT_FOUND' using errcode = 'P0001'; end if;
  if not public.can_manage_load_record(v_load) then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;

  v_financial_allowed := public.can_view_financial();
  if not v_financial_allowed and (v_patch ? 'custo_frete' or v_patch ? 'outros_custos' or v_patch ? 'faturamento_estimado') then
    raise exception 'FINANCIAL_FORBIDDEN' using errcode = 'P0001';
  end if;

  v_next_tipo := coalesce(nullif(v_patch->>'tipo', ''), v_load.tipo);
  v_new_status := coalesce(nullif(v_patch->>'status', ''), v_load.status);
  if not public.is_valid_load_status(v_new_status) then raise exception 'INVALID_LOAD_STATUS' using errcode = 'P0001'; end if;

  v_new_marketplace := coalesce(nullif(v_patch->>'marketplace_id', '')::uuid, v_load.marketplace_id);
  v_new_destino := coalesce(nullif(v_patch->>'destino_full_id', '')::uuid, v_load.destino_full_id);
  v_new_loja := coalesce(nullif(v_patch->>'loja_destino_id', '')::uuid, v_load.loja_destino_id);

  if v_next_tipo = 'FULL_MARKETPLACE' then
    if v_new_marketplace is null then raise exception 'MARKETPLACE_REQUIRED' using errcode = 'P0001'; end if;
    if v_new_destino is null then raise exception 'DESTINO_FULL_REQUIRED' using errcode = 'P0001'; end if;
    v_new_loja := null;
  elsif v_next_tipo = 'LOJA_FISICA' then
    if v_new_loja is null then raise exception 'LOJA_DESTINO_REQUIRED' using errcode = 'P0001'; end if;
    v_new_marketplace := null;
    v_new_destino := null;
  else
    raise exception 'INVALID_LOAD_TYPE' using errcode = 'P0001';
  end if;

  update public.loads set
    numero_carga_marketplace = coalesce(nullif(v_patch->>'numero_carga_marketplace', ''), numero_carga_marketplace),
    codigo_agendamento = coalesce(nullif(v_patch->>'codigo_agendamento', ''), codigo_agendamento),
    tipo = v_next_tipo,
    status = v_new_status,
    prioridade = coalesce(nullif(v_patch->>'prioridade', ''), prioridade),
    empresa_id = coalesce(nullif(v_patch->>'empresa_id', '')::uuid, empresa_id),
    canal_id = coalesce(nullif(v_patch->>'canal_id', '')::uuid, canal_id),
    marketplace_id = v_new_marketplace,
    destino_full_id = v_new_destino,
    loja_destino_id = v_new_loja,
    cd_origem_id = coalesce(nullif(v_patch->>'cd_origem_id', '')::uuid, cd_origem_id),
    data_agendada = coalesce(nullif(v_patch->>'data_agendada', '')::timestamptz, data_agendada),
    data_prevista_recebimento = coalesce(nullif(v_patch->>'data_prevista_recebimento', '')::timestamptz, data_prevista_recebimento),
    data_real_recebimento = coalesce(nullif(v_patch->>'data_real_recebimento', '')::timestamptz, data_real_recebimento),
    tipo_coleta_id = coalesce(nullif(v_patch->>'tipo_coleta_id', '')::uuid, tipo_coleta_id),
    transportador_id = coalesce(nullif(v_patch->>'transportador_id', '')::uuid, transportador_id),
    custo_frete = case when v_financial_allowed and v_patch ? 'custo_frete' then coalesce(nullif(v_patch->>'custo_frete', '')::numeric, 0) else custo_frete end,
    outros_custos = case when v_financial_allowed and v_patch ? 'outros_custos' then coalesce(nullif(v_patch->>'outros_custos', '')::numeric, 0) else outros_custos end,
    faturamento_estimado = case when v_financial_allowed and v_patch ? 'faturamento_estimado' then nullif(v_patch->>'faturamento_estimado', '')::numeric else faturamento_estimado end,
    responsavel_operacional_id = coalesce(nullif(v_patch->>'responsavel_operacional_id', '')::uuid, responsavel_operacional_id),
    observacoes = coalesce(nullif(v_patch->>'observacoes', ''), observacoes),
    updated_at = now()
  where id = p_load_id;

  if v_load.status is distinct from v_new_status then
    perform public.write_audit_field_safe('loads', p_load_id, 'LOAD_STATUS_CHANGED', 'status', v_load.status, v_new_status, null);
  end if;
  if v_patch ? 'data_agendada' then
    perform public.write_audit_field_safe('loads', p_load_id, 'LOAD_SCHEDULE_CHANGED', 'data_agendada', v_load.data_agendada::text, nullif(v_patch->>'data_agendada', ''), null);
  end if;
  if v_financial_allowed and v_patch ? 'custo_frete' then
    perform public.write_audit_field_safe('loads', p_load_id, 'LOAD_FREIGHT_COST_CHANGED', 'custo_frete', v_load.custo_frete::text, v_patch->>'custo_frete', null);
  end if;
  if v_financial_allowed and v_patch ? 'outros_custos' then
    perform public.write_audit_field_safe('loads', p_load_id, 'LOAD_OTHER_COSTS_CHANGED', 'outros_custos', v_load.outros_custos::text, v_patch->>'outros_custos', null);
  end if;
  if v_financial_allowed and v_patch ? 'faturamento_estimado' then
    perform public.write_audit_field_safe('loads', p_load_id, 'LOAD_ESTIMATED_REVENUE_CHANGED', 'faturamento_estimado', v_load.faturamento_estimado::text, v_patch->>'faturamento_estimado', null);
  end if;

  perform public.recalc_load_financial(p_load_id);
end;
$$;

revoke all on function public.patch_load_safe(uuid, jsonb) from public;
grant execute on function public.patch_load_safe(uuid, jsonb) to authenticated;

create or replace function public.add_comment_safe(p_entidade text, p_entidade_id uuid, p_texto text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.users_profile%rowtype;
  v_id uuid;
  v_load public.loads%rowtype;
  v_request public.load_requests%rowtype;
begin
  select * into v_profile from public.users_profile where auth_user_id = auth.uid() and ativo = true limit 1;
  if v_profile.id is null then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if trim(coalesce(p_texto, '')) = '' then raise exception 'COMMENT_REQUIRED' using errcode = 'P0001'; end if;

  if p_entidade = 'load' then
    select * into v_load from public.loads where id = p_entidade_id;
    if v_load.id is null or not public.can_view_load(v_load) then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  elsif p_entidade in ('load_request','request','solicitacao') then
    select * into v_request from public.load_requests where id = p_entidade_id;
    if v_request.id is null or not public.can_view_load_request(v_request) then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  else
    raise exception 'INVALID_ENTITY' using errcode = 'P0001';
  end if;

  insert into public.comments(entidade, entidade_id, texto, autor_profile_id)
  values (p_entidade, p_entidade_id, trim(p_texto), v_profile.id)
  returning id into v_id;

  perform public.write_audit_field_safe('comments', v_id, 'COMMENT_CREATED', 'texto', null, trim(p_texto), jsonb_build_object('entidade', p_entidade, 'entidade_id', p_entidade_id));
  return v_id;
end;
$$;

revoke all on function public.add_comment_safe(text, uuid, text) from public;
grant execute on function public.add_comment_safe(text, uuid, text) to authenticated;

-- Server-side paginated wrappers keep the same masked projections and add total_count.
create or replace function public.get_visible_loads_page(
  p_page integer default 1,
  p_page_size integer default 50
)
returns table (
  id uuid,
  codigo_interno text,
  numero_carga_marketplace text,
  codigo_agendamento text,
  tipo text,
  empresa_id uuid,
  canal_id uuid,
  marketplace_id uuid,
  destino_full_id uuid,
  loja_destino_id uuid,
  cd_origem_id uuid,
  status text,
  prioridade text,
  data_agendada timestamptz,
  data_prevista_recebimento timestamptz,
  data_real_recebimento timestamptz,
  tipo_coleta_id uuid,
  transportador_id uuid,
  custo_frete numeric,
  outros_custos numeric,
  faturamento_estimado numeric,
  cmv_total numeric,
  margem_estimativa_valor numeric,
  margem_estimativa_percentual numeric,
  solicitante_id uuid,
  responsavel_operacional_id uuid,
  observacoes text,
  cancelada_em timestamptz,
  cancelada_por uuid,
  motivo_cancelamento text,
  created_at timestamptz,
  updated_at timestamptz,
  canal_nome text,
  loja_nome text,
  responsavel_nome text,
  total_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select gl.*, count(*) over() as total_count
  from public.get_visible_loads() gl
  limit greatest(1, least(coalesce(p_page_size, 50), 100))
  offset greatest(0, coalesce(p_page, 1) - 1) * greatest(1, least(coalesce(p_page_size, 50), 100));
$$;

revoke all on function public.get_visible_loads_page(integer, integer) from public;
grant execute on function public.get_visible_loads_page(integer, integer) to authenticated;

create or replace function public.get_visible_products_page(
  p_page integer default 1,
  p_page_size integer default 50
)
returns table (
  id uuid,
  sku text,
  nome text,
  cmv numeric,
  fornecedor_id uuid,
  ativo boolean,
  last_synced_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  supplier_name text,
  total_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select gp.*, count(*) over() as total_count
  from public.get_visible_products() gp
  limit greatest(1, least(coalesce(p_page_size, 50), 100))
  offset greatest(0, coalesce(p_page, 1) - 1) * greatest(1, least(coalesce(p_page_size, 50), 100));
$$;

revoke all on function public.get_visible_products_page(integer, integer) from public;
grant execute on function public.get_visible_products_page(integer, integer) to authenticated;
