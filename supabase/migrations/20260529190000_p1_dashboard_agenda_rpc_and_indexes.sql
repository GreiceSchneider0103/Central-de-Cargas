-- P1 performance: reduce N+1 queries for dashboard/agenda and add supporting indexes.

-- Indexes for common filters and lookups (idempotent)
create index if not exists idx_loads_data_agendada on public.loads (data_agendada);
create index if not exists idx_loads_status on public.loads (status);
create index if not exists idx_loads_tipo on public.loads (tipo);
create index if not exists idx_loads_empresa_id on public.loads (empresa_id);
create index if not exists idx_loads_marketplace_id on public.loads (marketplace_id);
create index if not exists idx_loads_loja_destino_id on public.loads (loja_destino_id);
create index if not exists idx_load_items_load_id on public.load_items (load_id);
create index if not exists idx_comments_entidade_entidade_id_created_at on public.comments (entidade, entidade_id, created_at desc);

-- Enriched loads list for calendar/dashboard range views (suppliers + latest comment) without client-side N+1.
drop function if exists public.get_visible_loads_enriched_range(timestamptz, timestamptz, integer);
create or replace function public.get_visible_loads_enriched_range(
  p_from timestamptz,
  p_to timestamptz,
  p_limit integer default 800
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
  fornecedores text,
  comentario text
)
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select *
    from public.get_visible_loads() gl
    where gl.data_agendada >= p_from
      and gl.data_agendada < p_to
  ),
  suppliers_by_load as (
    select
      li.load_id,
      string_agg(distinct s.nome, ', ' order by s.nome) as fornecedores
    from public.load_items li
    left join public.suppliers s on s.id = li.fornecedor_origem_id
    where li.load_id in (select id from base)
    group by li.load_id
  ),
  latest_comment as (
    select distinct on (c.entidade_id)
      c.entidade_id as load_id,
      c.texto as comentario
    from public.comments c
    where c.entidade = 'load'
      and c.entidade_id in (select id from base)
    order by c.entidade_id, c.created_at desc
  )
  select
    b.*,
    coalesce(sbl.fornecedores, '') as fornecedores,
    lc.comentario
  from base b
  left join suppliers_by_load sbl on sbl.load_id = b.id
  left join latest_comment lc on lc.load_id = b.id
  order by b.data_agendada asc nulls last
  limit greatest(1, least(coalesce(p_limit, 800), 2000));
$$;

revoke all on function public.get_visible_loads_enriched_range(timestamptz, timestamptz, integer) from public;
grant execute on function public.get_visible_loads_enriched_range(timestamptz, timestamptz, integer) to authenticated;

-- Dashboard metrics computed server-side to avoid scanning large datasets in the browser.
drop function if exists public.get_dashboard_metrics(timestamptz);
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
    case when public.can_view_financial() then coalesce(sum(l.faturamento_estimado) filter (where l.created_at >= t.start_month), 0) else null end as fin_revenue_month,
    case when public.can_view_financial() then coalesce(sum(l.cmv_total) filter (where l.created_at >= t.start_month), 0) else null end as fin_cmv_month,
    case when public.can_view_financial() then coalesce(sum(l.custo_frete) filter (where l.created_at >= t.start_month), 0) else null end as fin_freight_month,
    case when public.can_view_financial() then coalesce(sum(l.margem_estimativa_valor) filter (where l.created_at >= t.start_month), 0) else null end as fin_margin_month
  from public.loads l
  cross join t
  where public.can_view_load(l);
$$;

revoke all on function public.get_dashboard_metrics(timestamptz) from public;
grant execute on function public.get_dashboard_metrics(timestamptz) to authenticated;

