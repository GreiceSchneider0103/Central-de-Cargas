-- P1: allow financial-only edits for financeiro role without granting operational write access.

drop function if exists public.patch_load_financial_safe(uuid, jsonb);
create or replace function public.patch_load_financial_safe(p_load_id uuid, p_patch jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_load public.loads%rowtype;
  v_profile public.users_profile%rowtype;
  v_fat numeric;
  v_frete numeric;
  v_outros numeric;
begin
  select * into v_profile from public.users_profile where auth_user_id = auth.uid() and ativo = true limit 1;
  if v_profile.id is null then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;

  if not public.can_view_financial() then
    raise exception 'FINANCIAL_FORBIDDEN' using errcode = 'P0001';
  end if;

  select * into v_load from public.loads where id = p_load_id for update;
  if v_load.id is null then raise exception 'LOAD_NOT_FOUND' using errcode = 'P0001'; end if;

  if not public.can_view_load(v_load) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  -- financeiro can edit any visible load financials; gerente_ecommerce only FULL
  if v_profile.perfil = 'gerente_ecommerce' and v_load.tipo <> 'FULL_MARKETPLACE' then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  v_frete := case when p_patch ? 'custo_frete' then coalesce(nullif(p_patch->>'custo_frete','')::numeric, 0) else v_load.custo_frete end;
  v_outros := case when p_patch ? 'outros_custos' then coalesce(nullif(p_patch->>'outros_custos','')::numeric, 0) else v_load.outros_custos end;
  v_fat := case when p_patch ? 'faturamento_estimado' then nullif(p_patch->>'faturamento_estimado','')::numeric else v_load.faturamento_estimado end;

  update public.loads set
    custo_frete = v_frete,
    outros_custos = v_outros,
    faturamento_estimado = v_fat,
    updated_at = now()
  where id = p_load_id;

  if p_patch ? 'custo_frete' then
    perform public.write_audit_field_safe('loads', p_load_id, 'LOAD_FREIGHT_COST_CHANGED', 'custo_frete', v_load.custo_frete::text, v_frete::text, null);
  end if;
  if p_patch ? 'outros_custos' then
    perform public.write_audit_field_safe('loads', p_load_id, 'LOAD_OTHER_COSTS_CHANGED', 'outros_custos', v_load.outros_custos::text, v_outros::text, null);
  end if;
  if p_patch ? 'faturamento_estimado' then
    perform public.write_audit_field_safe('loads', p_load_id, 'LOAD_ESTIMATED_REVENUE_CHANGED', 'faturamento_estimado', v_load.faturamento_estimado::text, coalesce(v_fat::text,''), null);
  end if;

  perform public.recalc_load_financial(p_load_id);
  perform public.evaluate_load_alerts(p_load_id);
end;
$$;

revoke all on function public.patch_load_financial_safe(uuid, jsonb) from public;
grant execute on function public.patch_load_financial_safe(uuid, jsonb) to authenticated;

