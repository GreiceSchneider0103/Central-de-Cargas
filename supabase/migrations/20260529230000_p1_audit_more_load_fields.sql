-- P1: audit additional operational fields updated via patch_load_safe.

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
  if v_patch ? 'data_prevista_recebimento' then
    perform public.write_audit_field_safe('loads', p_load_id, 'LOAD_EXPECTED_RECEIPT_CHANGED', 'data_prevista_recebimento', v_load.data_prevista_recebimento::text, nullif(v_patch->>'data_prevista_recebimento', ''), null);
  end if;
  if v_patch ? 'data_real_recebimento' then
    perform public.write_audit_field_safe('loads', p_load_id, 'LOAD_REAL_RECEIPT_CHANGED', 'data_real_recebimento', v_load.data_real_recebimento::text, nullif(v_patch->>'data_real_recebimento', ''), null);
  end if;
  if v_patch ? 'transportador_id' then
    perform public.write_audit_field_safe('loads', p_load_id, 'LOAD_TRANSPORT_CHANGED', 'transportador_id', v_load.transportador_id::text, nullif(v_patch->>'transportador_id', ''), null);
  end if;
  if v_patch ? 'responsavel_operacional_id' then
    perform public.write_audit_field_safe('loads', p_load_id, 'LOAD_RESPONSIBLE_CHANGED', 'responsavel_operacional_id', v_load.responsavel_operacional_id::text, nullif(v_patch->>'responsavel_operacional_id', ''), null);
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
  perform public.evaluate_load_alerts(p_load_id);
end;
$$;

revoke all on function public.patch_load_safe(uuid, jsonb) from public;
grant execute on function public.patch_load_safe(uuid, jsonb) to authenticated;

