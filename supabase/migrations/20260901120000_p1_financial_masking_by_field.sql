-- P1: split financial visibility into two independent axes instead of one binary gate,
-- matching the product document decisions (section 24):
--   "Vendedor vê margem? Não"        -> vendedor_loja loses margin/revenue, keeps cost visibility.
--   "Operador vê custo/CMV? Não"     -> operador_carga loses CMV/cost visibility, keeps margin/revenue.
-- can_view_financial() is left untouched: it still gates who may WRITE financial fields
-- (patch_load_safe, patch_load_financial_safe, patch_load_item_safe), which is unrelated
-- to this read-side masking change.

create or replace function public.can_view_costs()
returns boolean
language sql
stable
as $$
  select public.has_role(array['admin','gerente_estoque','gerente_ecommerce','financeiro','vendedor_loja']);
$$;

create or replace function public.can_view_margin()
returns boolean
language sql
stable
as $$
  select public.has_role(array['admin','gerente_estoque','gerente_ecommerce','financeiro','operador_carga']);
$$;

-- 1) get_visible_loads(): custo_frete/outros_custos/cmv_total -> can_view_costs();
--    faturamento_estimado/margem_* -> can_view_margin().
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
    case when public.can_view_costs() then l.custo_frete else null end,
    case when public.can_view_costs() then l.outros_custos else null end,
    case when public.can_view_margin() then l.faturamento_estimado else null end,
    case when public.can_view_costs() then l.cmv_total else null end,
    case when public.can_view_margin() then l.margem_estimativa_valor else null end,
    case when public.can_view_margin() then l.margem_estimativa_percentual else null end,
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

-- 2) get_visible_load_items(): cmv_unitario/cmv_total -> can_view_costs().
create or replace function public.get_visible_load_items(p_load_id uuid)
returns table (
  id uuid,
  load_id uuid,
  product_id uuid,
  sku text,
  nome_produto text,
  quantidade numeric,
  fornecedor_origem_id uuid,
  cmv_unitario numeric,
  cmv_total numeric,
  peso numeric,
  altura numeric,
  largura numeric,
  profundidade numeric,
  cubagem numeric,
  data_prevista_recebimento timestamptz,
  data_real_recebimento timestamptz,
  status_item text,
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
    li.load_id,
    li.product_id,
    li.sku,
    li.nome_produto,
    li.quantidade,
    li.fornecedor_origem_id,
    case when public.can_view_costs() then li.cmv_unitario else null end,
    case when public.can_view_costs() then li.cmv_total else null end,
    li.peso,
    li.altura,
    li.largura,
    li.profundidade,
    li.cubagem,
    li.data_prevista_recebimento,
    li.data_real_recebimento,
    li.status_item,
    li.observacao,
    li.created_at,
    li.updated_at
  from public.load_items li
  join public.loads l on l.id = li.load_id
  where li.load_id = p_load_id
    and public.can_view_load(l)
  order by li.created_at asc;
$$;

revoke all on function public.get_visible_load_items(uuid) from public;
grant execute on function public.get_visible_load_items(uuid) to authenticated;

-- 3) get_visible_load_request_items(): cmv_unitario/cmv_total -> can_view_costs().
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
    case when public.can_view_costs() then li.cmv_unitario else null end,
    case when public.can_view_costs() then li.cmv_total else null end,
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

-- 4) get_visible_products(): cmv -> can_view_costs().
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
    case when public.can_view_costs() then p.cmv else null end,
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

-- 5) get_visible_product_by_sku(): cmv -> can_view_costs().
create or replace function public.get_visible_product_by_sku(p_sku text)
returns table (
  id uuid,
  nome text,
  cmv numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.nome,
    case when public.can_view_costs() then p.cmv else null end
  from public.products p
  where auth.uid() is not null
    and p.sku = p_sku
  limit 1;
$$;

-- 6) get_dashboard_metrics(): revenue/margin -> can_view_margin(); cmv/freight -> can_view_costs().
create or replace function public.get_dashboard_metrics(p_now timestamptz default now())
returns table (
  loads_day bigint,
  loads_week bigint,
  loads_month bigint,
  loads_pending bigint,
  loads_overdue bigint,
  loads_wait_supplier bigint,
  loads_wait_receipt bigint,
  loads_wait_label bigint,
  loads_wait_nf bigint,
  loads_ready_pickup bigint,
  fin_revenue_month numeric,
  fin_cmv_month numeric,
  fin_freight_month numeric,
  fin_margin_month numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with t as (
    select
      date_trunc('day', p_now) as start_day,
      (date_trunc('day', p_now) - (extract(dow from date_trunc('day', p_now))::int) * interval '1 day') as start_week,
      date_trunc('month', p_now) as start_month
  )
  select
    count(*) filter (where l.data_agendada >= t.start_day and l.data_agendada < t.start_day + interval '1 day') as loads_day,
    count(*) filter (where l.data_agendada >= t.start_week) as loads_week,
    count(*) filter (where l.data_agendada >= t.start_month) as loads_month,
    count(*) filter (where l.status in ('Rascunho','Aguardando aprovação')) as loads_pending,
    count(*) filter (where l.data_agendada is not null and l.data_agendada < p_now and l.status not in ('Finalizada','Entregue','Cancelada')) as loads_overdue,
    count(*) filter (where l.status = 'Aguardando fornecedor') as loads_wait_supplier,
    count(*) filter (where l.status = 'Aguardando recebimento') as loads_wait_receipt,
    count(*) filter (where l.status = 'Etiquetando') as loads_wait_label,
    count(*) filter (where l.status = 'Aguardando NF') as loads_wait_nf,
    count(*) filter (where l.status = 'Pronta para coleta') as loads_ready_pickup,
    case when public.can_view_margin() then coalesce(sum(l.faturamento_estimado) filter (where l.created_at >= t.start_month), 0) else null end as fin_revenue_month,
    case when public.can_view_costs() then coalesce(sum(l.cmv_total) filter (where l.created_at >= t.start_month), 0) else null end as fin_cmv_month,
    case when public.can_view_costs() then coalesce(sum(l.custo_frete) filter (where l.created_at >= t.start_month), 0) else null end as fin_freight_month,
    case when public.can_view_margin() then coalesce(sum(l.margem_estimativa_valor) filter (where l.created_at >= t.start_month), 0) else null end as fin_margin_month
  from public.loads l
  cross join t
  where public.can_view_load(l);
$$;

revoke all on function public.get_dashboard_metrics(timestamptz) from public;
grant execute on function public.get_dashboard_metrics(timestamptz) to authenticated;
