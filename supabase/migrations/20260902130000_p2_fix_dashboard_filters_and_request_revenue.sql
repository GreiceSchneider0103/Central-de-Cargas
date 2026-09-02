-- Fix 3 critical findings from the system-wide diagnosis (2026-09-02):
-- 1) Dashboard StatCards ignored the Tipo/Status filters (always read the
--    unfiltered get_dashboard_metrics RPC). Add optional p_tipo/p_status
--    filters to the RPC so the client can re-fetch filtered metrics.
-- 2) load_requests never captured an estimated revenue, so it was never
--    available on the resulting load after conversion. Add the column and
--    copy it through convert_load_request_to_load.

-- 1) Dashboard metrics: accept optional tipo/status filters.
drop function if exists public.get_dashboard_metrics(timestamptz);

create or replace function public.get_dashboard_metrics(
  p_now timestamptz default now(),
  p_tipo text default null,
  p_status text default null
)
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
  where public.can_view_load(l)
    and (p_tipo is null or l.tipo = p_tipo)
    and (p_status is null or l.status = p_status);
$$;

revoke all on function public.get_dashboard_metrics(timestamptz, text, text) from public;
grant execute on function public.get_dashboard_metrics(timestamptz, text, text) to authenticated;

-- 2) load_requests: capture estimated revenue at request time.
alter table public.load_requests add column if not exists faturamento_estimado numeric;

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
