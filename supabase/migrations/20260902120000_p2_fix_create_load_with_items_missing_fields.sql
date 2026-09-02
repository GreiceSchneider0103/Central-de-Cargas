-- Fix: create_load_with_items dropped data_real_recebimento and status_item
-- from the very first item of a new load. upsert_load_item_safe (used to add
-- items to an already-existing load) already persists both fields; the
-- create-time path was silently discarding them since the function's
-- original insert column list never included them.

create or replace function public.create_load_with_items(
  p_load jsonb,
  p_items jsonb
)
returns table(load_id uuid, codigo_interno text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_profile public.users_profile%rowtype;
  v_tipo text;
  v_status text;
  v_empresa_id uuid;
  v_canal_id uuid;
  v_marketplace_id uuid;
  v_destino_full_id uuid;
  v_loja_destino_id uuid;
  v_cd_origem_id uuid;
  v_tipo_coleta_id uuid;
  v_transportador_id uuid;
  v_new_load public.loads%rowtype;
  v_item jsonb;
  v_sku text;
  v_nome text;
  v_quantidade numeric;
  v_cmv numeric;
  v_fornecedor_id uuid;
  v_product_id uuid;
  v_product public.products%rowtype;
  v_item_count integer;
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

  if v_profile.perfil not in ('admin','gerente_estoque','gerente_ecommerce') then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  v_tipo := nullif(p_load->>'tipo', '');
  v_status := coalesce(nullif(p_load->>'status', ''), 'Rascunho');
  v_empresa_id := nullif(p_load->>'empresa_id', '')::uuid;
  v_canal_id := nullif(p_load->>'canal_id', '')::uuid;
  v_marketplace_id := nullif(p_load->>'marketplace_id', '')::uuid;
  v_destino_full_id := nullif(p_load->>'destino_full_id', '')::uuid;
  v_loja_destino_id := nullif(p_load->>'loja_destino_id', '')::uuid;
  v_cd_origem_id := nullif(p_load->>'cd_origem_id', '')::uuid;
  v_tipo_coleta_id := nullif(p_load->>'tipo_coleta_id', '')::uuid;
  v_transportador_id := nullif(p_load->>'transportador_id', '')::uuid;

  if v_tipo not in ('LOJA_FISICA','FULL_MARKETPLACE') then
    raise exception 'INVALID_LOAD_TYPE' using errcode = 'P0001';
  end if;

  if not public.is_valid_load_status(v_status) then
    raise exception 'INVALID_LOAD_STATUS' using errcode = 'P0001';
  end if;

  if v_empresa_id is null then
    raise exception 'EMPRESA_REQUIRED' using errcode = 'P0001';
  end if;

  if v_canal_id is null then
    raise exception 'CANAL_REQUIRED' using errcode = 'P0001';
  end if;

  if v_profile.perfil = 'gerente_ecommerce' and v_tipo <> 'FULL_MARKETPLACE' then
    raise exception 'FORBIDDEN_LOAD_TYPE' using errcode = 'P0001';
  end if;

  if v_tipo = 'FULL_MARKETPLACE' then
    if v_marketplace_id is null then
      raise exception 'MARKETPLACE_REQUIRED' using errcode = 'P0001';
    end if;
    if v_destino_full_id is null then
      raise exception 'DESTINO_FULL_REQUIRED' using errcode = 'P0001';
    end if;
    v_loja_destino_id := null;
  end if;

  if v_tipo = 'LOJA_FISICA' then
    if v_loja_destino_id is null then
      raise exception 'LOJA_DESTINO_REQUIRED' using errcode = 'P0001';
    end if;
    v_marketplace_id := null;
    v_destino_full_id := null;
  end if;

  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'ITEMS_MUST_BE_ARRAY' using errcode = 'P0001';
  end if;

  select count(*) into v_item_count from jsonb_array_elements(p_items);
  if v_item_count = 0 then
    raise exception 'LOAD_WITHOUT_ITEMS' using errcode = 'P0001';
  end if;

  insert into public.loads (
    tipo,
    status,
    prioridade,
    empresa_id,
    canal_id,
    marketplace_id,
    destino_full_id,
    loja_destino_id,
    cd_origem_id,
    tipo_coleta_id,
    transportador_id,
    custo_frete,
    outros_custos,
    faturamento_estimado,
    numero_carga_marketplace,
    codigo_agendamento,
    solicitante_id,
    responsavel_operacional_id,
    observacoes
  ) values (
    v_tipo,
    v_status,
    nullif(p_load->>'prioridade', ''),
    v_empresa_id,
    v_canal_id,
    v_marketplace_id,
    v_destino_full_id,
    v_loja_destino_id,
    v_cd_origem_id,
    v_tipo_coleta_id,
    v_transportador_id,
    coalesce(nullif(p_load->>'custo_frete', '')::numeric, 0),
    coalesce(nullif(p_load->>'outros_custos', '')::numeric, 0),
    nullif(p_load->>'faturamento_estimado', '')::numeric,
    nullif(p_load->>'numero_carga_marketplace', ''),
    nullif(p_load->>'codigo_agendamento', ''),
    v_profile.id,
    nullif(p_load->>'responsavel_operacional_id', '')::uuid,
    nullif(p_load->>'observacoes', '')
  ) returning * into v_new_load;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_sku := trim(coalesce(v_item->>'sku', ''));
    v_nome := trim(coalesce(v_item->>'nome_produto', ''));
    v_quantidade := nullif(v_item->>'quantidade', '')::numeric;
    v_fornecedor_id := nullif(v_item->>'fornecedor_origem_id', '')::uuid;
    v_product_id := nullif(v_item->>'product_id', '')::uuid;

    if v_sku = '' then
      raise exception 'ITEM_SKU_REQUIRED' using errcode = 'P0001';
    end if;

    if v_quantidade is null or v_quantidade <= 0 then
      raise exception 'ITEM_QUANTITY_INVALID' using errcode = 'P0001';
    end if;

    select * into v_product
    from public.products
    where sku = v_sku
    limit 1;

    if v_product.id is not null then
      v_product_id := v_product.id;
      if v_nome = '' then
        v_nome := v_product.nome;
      end if;
    end if;

    if v_nome = '' then
      raise exception 'ITEM_NAME_REQUIRED' using errcode = 'P0001';
    end if;

    v_cmv := coalesce(nullif(v_item->>'cmv_unitario', '')::numeric, v_product.cmv, 0);
    if v_cmv < 0 then
      raise exception 'ITEM_CMV_INVALID' using errcode = 'P0001';
    end if;

    insert into public.load_items (
      load_id,
      product_id,
      sku,
      nome_produto,
      quantidade,
      fornecedor_origem_id,
      cmv_unitario,
      peso,
      altura,
      largura,
      profundidade,
      data_prevista_recebimento,
      data_real_recebimento,
      status_item,
      observacao
    ) values (
      v_new_load.id,
      v_product_id,
      v_sku,
      v_nome,
      v_quantidade,
      v_fornecedor_id,
      v_cmv,
      nullif(v_item->>'peso', '')::numeric,
      nullif(v_item->>'altura', '')::numeric,
      nullif(v_item->>'largura', '')::numeric,
      nullif(v_item->>'profundidade', '')::numeric,
      nullif(v_item->>'data_prevista_recebimento', '')::timestamptz,
      nullif(v_item->>'data_real_recebimento', '')::timestamptz,
      nullif(v_item->>'status_item', ''),
      nullif(v_item->>'observacao', '')
    );
  end loop;

  insert into public.load_checklists(load_id)
  values (v_new_load.id)
  on conflict (load_id) do nothing;

  insert into public.audit_logs(tabela, registro_id, acao, payload, profile_id)
  values (
    'loads',
    v_new_load.id,
    'LOAD_CREATED_WITH_ITEMS',
    jsonb_build_object('codigo_interno', v_new_load.codigo_interno, 'tipo', v_new_load.tipo, 'items_count', v_item_count),
    v_profile.id
  );

  return query select v_new_load.id, v_new_load.codigo_interno;
end;
$$;

revoke all on function public.create_load_with_items(jsonb, jsonb) from public;
grant execute on function public.create_load_with_items(jsonb, jsonb) to authenticated;
