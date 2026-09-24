create or replace function public.finalize_load_with_checklist(p_load_id uuid)
returns table(load_id uuid, warning text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
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
