-- P1 business rules: enforce required fields on finalize and persist operational alerts.

-- Alerts table (idempotent)
create table if not exists public.load_alerts (
  id uuid primary key default gen_random_uuid(),
  load_id uuid not null references public.loads(id) on delete cascade,
  alert_type text not null,
  message text,
  active boolean not null default true,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (load_id, alert_type)
);

create trigger trg_load_alerts_updated_at
before update on public.load_alerts
for each row execute function public.set_updated_at();

alter table public.load_alerts enable row level security;

drop policy if exists "load_alerts_select" on public.load_alerts;
drop policy if exists "load_alerts_write" on public.load_alerts;

create policy "load_alerts_select" on public.load_alerts
for select
using (
  exists (
    select 1
    from public.loads l
    where l.id = load_id
      and public.can_view_load(l)
  )
);

-- No direct writes from clients; only via SECURITY DEFINER function.
create policy "load_alerts_write" on public.load_alerts
for all
using (false)
with check (false);

-- Upsert/resolve helper (SECURITY DEFINER)
drop function if exists public.upsert_load_alert(uuid, text, text, boolean);
create or replace function public.upsert_load_alert(
  p_load_id uuid,
  p_alert_type text,
  p_message text,
  p_active boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.load_alerts(load_id, alert_type, message, active, resolved_at)
  values (p_load_id, p_alert_type, p_message, p_active, case when p_active then null else now() end)
  on conflict (load_id, alert_type) do update set
    message = excluded.message,
    active = excluded.active,
    resolved_at = case when excluded.active then null else now() end,
    updated_at = now();
end;
$$;

revoke all on function public.upsert_load_alert(uuid, text, text, boolean) from public;
grant execute on function public.upsert_load_alert(uuid, text, text, boolean) to authenticated;

-- Evaluate alerts for a load (SECURITY DEFINER)
drop function if exists public.evaluate_load_alerts(uuid);
create or replace function public.evaluate_load_alerts(p_load_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_load public.loads%rowtype;
  v_check public.load_checklists%rowtype;
  v_missing_cmv boolean;
  v_bad_schedule boolean;
begin
  select * into v_load from public.loads where id = p_load_id;
  if v_load.id is null then
    return;
  end if;

  select * into v_check from public.load_checklists where load_id = p_load_id;

  v_missing_cmv := exists(
    select 1 from public.load_items li
    where li.load_id = p_load_id
      and coalesce(li.cmv_unitario, 0) <= 0
  );

  v_bad_schedule := (
    v_load.data_agendada is not null
    and (
      (v_load.data_prevista_recebimento is not null and v_load.data_agendada < v_load.data_prevista_recebimento)
      or exists (
        select 1 from public.load_items li
        where li.load_id = p_load_id
          and li.data_prevista_recebimento is not null
          and li.data_prevista_recebimento > v_load.data_agendada
      )
    )
  );

  perform public.upsert_load_alert(
    p_load_id,
    'FULL_SEM_NUMERO_MARKETPLACE',
    'Carga FULL sem número de carga marketplace.',
    v_load.tipo = 'FULL_MARKETPLACE' and nullif(trim(coalesce(v_load.numero_carga_marketplace,'')), '') is null
  );

  perform public.upsert_load_alert(
    p_load_id,
    'FULL_SEM_CODIGO_AGENDAMENTO',
    'Carga FULL sem código de agendamento.',
    v_load.tipo = 'FULL_MARKETPLACE' and nullif(trim(coalesce(v_load.codigo_agendamento,'')), '') is null
  );

  perform public.upsert_load_alert(
    p_load_id,
    'FINALIZADA_SEM_NF',
    'Carga finalizada sem NF emitida (checklist).',
    v_load.status = 'Finalizada' and coalesce(v_check.nf_emitida, false) = false
  );

  perform public.upsert_load_alert(
    p_load_id,
    'PRODUTO_SEM_CMV',
    'Existe item com CMV unitário vazio/zero.',
    v_missing_cmv
  );

  perform public.upsert_load_alert(
    p_load_id,
    'SEM_FATURAMENTO_ESTIMADO',
    'Carga sem faturamento estimado.',
    coalesce(v_load.faturamento_estimado, 0) <= 0
  );

  perform public.upsert_load_alert(
    p_load_id,
    'AGENDADA_ANTES_RECEBIMENTO',
    'Carga agendada antes do recebimento previsto.',
    v_bad_schedule
  );
end;
$$;

revoke all on function public.evaluate_load_alerts(uuid) from public;
grant execute on function public.evaluate_load_alerts(uuid) to authenticated;

-- Recalc: if any item has missing CMV, keep CMV total but mark margins pending to avoid misleading numbers.
create or replace function public.recalc_load_financial(p_load_id uuid)
returns void language plpgsql as $$
declare
  v_cmv numeric;
  v_fat numeric;
  v_frete numeric;
  v_outros numeric;
  v_margem numeric;
  v_has_missing_cmv boolean;
begin
  select coalesce(sum(cmv_total),0) into v_cmv from public.load_items where load_id = p_load_id;
  select faturamento_estimado, custo_frete, outros_custos into v_fat, v_frete, v_outros from public.loads where id = p_load_id;
  v_has_missing_cmv := exists(select 1 from public.load_items where load_id = p_load_id and coalesce(cmv_unitario,0) <= 0);

  v_margem := coalesce(v_fat,0) - v_cmv - coalesce(v_frete,0) - coalesce(v_outros,0);

  update public.loads set
    cmv_total = v_cmv,
    margem_estimativa_valor = case
      when v_has_missing_cmv then null
      when v_fat is null then null
      else v_margem
    end,
    margem_estimativa_percentual = case
      when v_has_missing_cmv then null
      when coalesce(v_fat,0) > 0 then (v_margem / v_fat)
      else null
    end,
    updated_at = now()
  where id = p_load_id;
end; $$;

-- Enforce FULL required fields on finalize; keep NF-not-emitted as warning (not blocking) for MVP.
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
  v_missing_cmv boolean;
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

  if v_load.tipo = 'FULL_MARKETPLACE' then
    if nullif(trim(coalesce(v_load.numero_carga_marketplace, '')), '') is null then
      raise exception 'FULL_MARKETPLACE_NUMBER_REQUIRED' using errcode = 'P0001';
    end if;
    if nullif(trim(coalesce(v_load.codigo_agendamento, '')), '') is null then
      raise exception 'FULL_MARKETPLACE_SCHEDULE_CODE_REQUIRED' using errcode = 'P0001';
    end if;
  end if;

  v_missing_cmv := exists(select 1 from public.load_items where load_id = p_load_id and coalesce(cmv_unitario,0) <= 0);

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

  if v_missing_cmv then
    v_warning := case when v_warning is null then 'ITEM_WITHOUT_CMV' else v_warning || '+ITEM_WITHOUT_CMV' end;
  end if;
  if coalesce(v_load.faturamento_estimado, 0) <= 0 then
    v_warning := case when v_warning is null then 'NO_ESTIMATED_REVENUE' else v_warning || '+NO_ESTIMATED_REVENUE' end;
  end if;

  insert into public.audit_logs(tabela, registro_id, acao, payload, profile_id)
  values (
    'loads',
    p_load_id,
    'LOAD_FINALIZED',
    jsonb_build_object('previous_status', v_load.status, 'new_status', 'Finalizada', 'warning', v_warning),
    v_profile.id
  );

  perform public.recalc_load_financial(p_load_id);
  perform public.evaluate_load_alerts(p_load_id);

  return query select p_load_id, v_warning;
end;
$$;

revoke all on function public.finalize_load_with_checklist(uuid) from public;
grant execute on function public.finalize_load_with_checklist(uuid) to authenticated;

