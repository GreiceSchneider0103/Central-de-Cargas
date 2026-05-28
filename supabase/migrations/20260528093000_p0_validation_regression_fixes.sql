-- P0 validation follow-up: preserve non-financial labels and mask request-item CMV reads.

-- Preserve agenda/product labels while keeping financial masking centralized in safe RPCs.
drop function if exists public.get_visible_loads();

create or replace function public.get_visible_loads()
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
  responsavel_nome text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.id,
    l.codigo_interno,
    l.numero_carga_marketplace,
    l.codigo_agendamento,
    l.tipo,
    l.empresa_id,
    l.canal_id,
    l.marketplace_id,
    l.destino_full_id,
    l.loja_destino_id,
    l.cd_origem_id,
    l.status,
    l.prioridade,
    l.data_agendada,
    l.data_prevista_recebimento,
    l.data_real_recebimento,
    l.tipo_coleta_id,
    l.transportador_id,
    case when public.can_view_financial() then l.custo_frete else null end,
    case when public.can_view_financial() then l.outros_custos else null end,
    case when public.can_view_financial() then l.faturamento_estimado else null end,
    case when public.can_view_financial() then l.cmv_total else null end,
    case when public.can_view_financial() then l.margem_estimativa_valor else null end,
    case when public.can_view_financial() then l.margem_estimativa_percentual else null end,
    l.solicitante_id,
    l.responsavel_operacional_id,
    l.observacoes,
    l.cancelada_em,
    l.cancelada_por,
    l.motivo_cancelamento,
    l.created_at,
    l.updated_at,
    c.nome as canal_nome,
    s.nome as loja_nome,
    up.nome as responsavel_nome
  from public.loads l
  left join public.channels c on c.id = l.canal_id
  left join public.stores s on s.id = l.loja_destino_id
  left join public.users_profile up on up.id = l.responsavel_operacional_id
  where public.can_view_load(l)
  order by l.created_at desc;
$$;

revoke all on function public.get_visible_loads() from public;
grant execute on function public.get_visible_loads() to authenticated;

drop function if exists public.get_visible_products();

create or replace function public.get_visible_products()
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
  supplier_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.sku,
    p.nome,
    case when public.can_view_financial() then p.cmv else null end,
    p.fornecedor_id,
    p.ativo,
    p.last_synced_at,
    p.created_at,
    p.updated_at,
    s.nome as supplier_name
  from public.products p
  left join public.suppliers s on s.id = p.fornecedor_id
  where auth.uid() is not null
  order by p.nome asc;
$$;

revoke all on function public.get_visible_products() from public;
grant execute on function public.get_visible_products() to authenticated;

-- Request items also contain CMV and must not be directly readable by non-financial profiles.
revoke select on public.load_request_items from authenticated;
grant select (
  id,
  request_id,
  product_id,
  sku,
  nome_produto,
  quantidade,
  fornecedor_origem_id,
  data_prevista_recebimento,
  observacao,
  created_at,
  updated_at
) on public.load_request_items to authenticated;

create or replace function public.get_visible_load_request_items(p_request_id uuid)
returns table (
  id uuid,
  request_id uuid,
  product_id uuid,
  sku text,
  nome_produto text,
  quantidade numeric,
  fornecedor_origem_id uuid,
  cmv_unitario numeric,
  cmv_total numeric,
  data_prevista_recebimento timestamptz,
  observacao text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    li.id,
    li.request_id,
    li.product_id,
    li.sku,
    li.nome_produto,
    li.quantidade,
    li.fornecedor_origem_id,
    case when public.can_view_financial() then li.cmv_unitario else null end,
    case when public.can_view_financial() then li.cmv_total else null end,
    li.data_prevista_recebimento,
    li.observacao,
    li.created_at,
    li.updated_at
  from public.load_request_items li
  join public.load_requests lr on lr.id = li.request_id
  where li.request_id = p_request_id
    and public.can_view_load_request(lr)
  order by li.created_at asc;
$$;

revoke all on function public.get_visible_load_request_items(uuid) from public;
grant execute on function public.get_visible_load_request_items(uuid) to authenticated;

-- Defense in depth: the narrow checklist status RPC must also honor load visibility.
create or replace function public.set_load_operational_status_from_checklist(
  p_load_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_profile public.users_profile%rowtype;
  v_load public.loads%rowtype;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'UNAUTHORIZED' using errcode = 'P0001';
  end if;

  select * into v_profile
  from public.users_profile
  where auth_user_id = v_uid and ativo = true
  limit 1;

  if v_profile.id is null or v_profile.perfil not in ('admin','gerente_estoque','operador_carga') then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  if p_status not in ('Agendada','Carregada','Finalizada') then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;

  select * into v_load from public.loads where id = p_load_id for update;
  if v_load.id is null then
    raise exception 'LOAD_NOT_FOUND' using errcode = 'P0001';
  end if;

  if not public.can_view_load(v_load) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  update public.loads
  set status = p_status,
      updated_at = now()
  where id = p_load_id;
end;
$$;

revoke all on function public.set_load_operational_status_from_checklist(uuid, text) from public;
grant execute on function public.set_load_operational_status_from_checklist(uuid, text) to authenticated;
