-- Solicitações por perfil, operação do estoque e fornecedores na importação.
-- 1) normalize_supplier_name + import_products_for_companies reconhecendo
--    fornecedores pela razão social e cadastrando os que faltam.
-- 2) get_visible_products_by_skus: resolve uma lista de SKUs (colar lista /
--    planilha de itens na solicitação).
-- 3) resubmit_load_request: quem solicitou corrige os itens e reenvia depois
--    de "Ajuste solicitado".
-- 4) convert_load_request_to_load: a carga herda a data desejada e o
--    faturamento (preço de venda × quantidade) e os itens recebem CMV,
--    fornecedor, peso e medidas do cadastro.
-- 5) set_load_operational_status_from_checklist aceita os status da operação
--    do estoque (Separando, Pronta para coleta, Carregada, Em trânsito,
--    Entregue, Finalizada) e registra auditoria.

-- 1) Fornecedores -------------------------------------------------------------

create or replace function public.normalize_supplier_name(p_name text)
returns text
language sql
immutable
as $$
  select trim(regexp_replace(
    regexp_replace(
      regexp_replace(
        translate(lower(coalesce(p_name, '')), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'),
        '[^a-z0-9]+', ' ', 'g'
      ),
      '\m(ltda|me|epp|eireli|sa|cia|industria|comercio|moveis|movel|de|do|da|dos|das|e)\M', ' ', 'g'
    ),
    '\s+', ' ', 'g'
  ));
$$;

create or replace function public.import_products_for_companies(
  p_company_ids uuid[],
  p_rows jsonb
)
returns table(created integer, updated integer, linked integer, skipped integer)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_profile public.users_profile%rowtype;
  v_total integer;
  v_valid integer;
  v_created integer;
  v_linked integer;
  v_company_ids uuid[];
  v_now timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED' using errcode = 'P0001';
  end if;

  select * into v_profile
  from public.users_profile
  where auth_user_id = auth.uid() and ativo = true
  limit 1;

  if v_profile.id is null or v_profile.perfil not in ('admin', 'gerente_estoque') then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  select array_agg(distinct c) into v_company_ids
  from unnest(p_company_ids) c
  where c is not null;

  if coalesce(cardinality(v_company_ids), 0) = 0 then
    raise exception 'EMPRESA_REQUIRED' using errcode = 'P0001';
  end if;

  if (select count(*) from public.companies where id = any(v_company_ids)) <> cardinality(v_company_ids) then
    raise exception 'EMPRESA_NOT_FOUND' using errcode = 'P0001';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'INVALID_PAYLOAD' using errcode = 'P0001';
  end if;

  v_total := jsonb_array_length(p_rows);

  -- Fornecedores: reconhece pelo nome normalizado (sem LTDA, "indústria e
  -- comércio de móveis", acentos...) e cadastra os que ainda não existem.
  insert into public.suppliers (nome)
  select distinct on (public.normalize_supplier_name(f.nome)) f.nome
  from (
    select trim(e->>'fornecedor') as nome
    from jsonb_array_elements(p_rows) e
  ) f
  where coalesce(f.nome, '') <> ''
    and public.normalize_supplier_name(f.nome) <> ''
    and not exists (
      select 1 from public.suppliers s
      where public.normalize_supplier_name(s.nome) = public.normalize_supplier_name(f.nome)
    )
  order by public.normalize_supplier_name(f.nome), f.nome
  on conflict (nome) do nothing;

  drop table if exists tmp_import_products;
  create temp table tmp_import_products on commit drop as
  select distinct on (r.sku)
    r.sku,
    r.nome,
    case when r.cmv > 0 then r.cmv else null end as cmv,
    s.id as fornecedor_id,
    case when r.peso > 0 then r.peso else null end as peso,
    case when r.altura > 0 then r.altura else null end as altura,
    case when r.largura > 0 then r.largura else null end as largura,
    case when r.profundidade > 0 then r.profundidade else null end as profundidade,
    case when r.preco_venda > 0 then r.preco_venda else null end as preco_venda
  from (
    select
      trim(e->>'sku') as sku,
      trim(e->>'nome') as nome,
      nullif(e->>'cmv', '')::numeric as cmv,
      nullif(trim(e->>'fornecedor'), '') as fornecedor,
      nullif(e->>'peso', '')::numeric as peso,
      nullif(e->>'altura', '')::numeric as altura,
      nullif(e->>'largura', '')::numeric as largura,
      nullif(e->>'profundidade', '')::numeric as profundidade,
      nullif(e->>'preco_venda', '')::numeric as preco_venda
    from jsonb_array_elements(p_rows) e
  ) r
  left join lateral (
    select s.id
    from public.suppliers s
    where r.fornecedor is not null
      and public.normalize_supplier_name(s.nome) = public.normalize_supplier_name(r.fornecedor)
    order by s.ativo desc, s.created_at
    limit 1
  ) s on true
  where coalesce(r.sku, '') <> '' and coalesce(r.nome, '') <> ''
  -- SKU repetido na planilha: vale a linha com custo preenchido.
  order by r.sku, (r.cmv > 0) desc nulls last;

  select count(*) into v_valid from tmp_import_products;

  with upserted as (
    insert into public.products (sku, nome, cmv, fornecedor_id, peso, altura, largura, profundidade, preco_venda, last_synced_at)
    select sku, nome, coalesce(cmv, 0), fornecedor_id, peso, altura, largura, profundidade, preco_venda, v_now
    from tmp_import_products
    on conflict (sku) do update
      set nome = excluded.nome,
          cmv = case when excluded.cmv > 0 then excluded.cmv else products.cmv end,
          fornecedor_id = coalesce(excluded.fornecedor_id, products.fornecedor_id),
          peso = coalesce(excluded.peso, products.peso),
          altura = coalesce(excluded.altura, products.altura),
          largura = coalesce(excluded.largura, products.largura),
          profundidade = coalesce(excluded.profundidade, products.profundidade),
          preco_venda = coalesce(excluded.preco_venda, products.preco_venda),
          last_synced_at = excluded.last_synced_at
    returning (xmax = 0) as inserted
  )
  select count(*) filter (where inserted) into v_created from upserted;

  with ins as (
    insert into public.product_companies (product_id, company_id)
    select p.id, c.company_id
    from public.products p
    join tmp_import_products t on t.sku = p.sku
    cross join unnest(v_company_ids) as c(company_id)
    on conflict (product_id, company_id) do nothing
    returning 1
  )
  select count(*) into v_linked from ins;

  insert into public.audit_logs(tabela, registro_id, acao, payload, profile_id)
  select
    'companies',
    c,
    'PRODUCTS_IMPORTED',
    jsonb_build_object('rows', v_total, 'valid', v_valid, 'created', v_created, 'linked', v_linked, 'companies', to_jsonb(v_company_ids)),
    v_profile.id
  from unnest(v_company_ids) c;

  return query select v_created, v_valid - v_created, v_linked, v_total - v_valid;
end;
$$;

-- 2) Resolver lista de SKUs ------------------------------------------------------

create or replace function public.get_visible_products_by_skus(
  p_skus text[],
  p_company_id uuid default null
)
returns table (
  id uuid,
  sku text,
  nome text,
  cmv numeric,
  preco_venda numeric,
  in_company boolean
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
    case when public.can_view_financial() then p.preco_venda else null end,
    p_company_id is null or exists (
      select 1 from public.product_companies pc
      where pc.product_id = p.id and pc.company_id = p_company_id
    )
  from public.products p
  where auth.uid() is not null
    and p.sku = any(p_skus);
$$;

revoke all on function public.get_visible_products_by_skus(text[], uuid) from public;
grant execute on function public.get_visible_products_by_skus(text[], uuid) to authenticated;

-- 3) Reenviar solicitação após ajuste --------------------------------------------

create or replace function public.resubmit_load_request(
  p_request_id uuid,
  p_items jsonb,
  p_observacoes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.users_profile%rowtype;
  v_request public.load_requests%rowtype;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED' using errcode = 'P0001';
  end if;

  select * into v_profile from public.users_profile where auth_user_id = auth.uid() and ativo = true limit 1;
  if v_profile.id is null then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  select * into v_request from public.load_requests where id = p_request_id for update;
  if v_request.id is null then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0001';
  end if;

  if not (v_request.solicitante_id = v_profile.id or v_profile.perfil in ('admin', 'gerente_estoque')) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  if v_request.status not in ('Ajuste solicitado', 'Pendente') then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'REQUEST_WITHOUT_ITEMS' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) e
    where trim(coalesce(e->>'sku', '')) = ''
      or trim(coalesce(e->>'nome_produto', '')) = ''
      or coalesce(nullif(e->>'quantidade', '')::numeric, 0) <= 0
  ) then
    raise exception 'FIELD_REQUIRED' using errcode = 'P0001';
  end if;

  delete from public.load_request_items where request_id = p_request_id;

  insert into public.load_request_items (request_id, product_id, sku, nome_produto, quantidade)
  select
    p_request_id,
    (select p.id from public.products p where p.sku = trim(e->>'sku') limit 1),
    trim(e->>'sku'),
    trim(e->>'nome_produto'),
    (e->>'quantidade')::numeric
  from jsonb_array_elements(p_items) e;

  update public.load_requests
  set status = 'Pendente',
      motivo_recusa = null,
      observacoes = coalesce(p_observacoes, observacoes)
  where id = p_request_id;

  insert into public.load_request_history (request_id, acao, status_anterior, status_novo, autor_profile_id)
  values (p_request_id, 'REENVIADA', v_request.status, 'Pendente', v_profile.id);
end;
$$;

revoke all on function public.resubmit_load_request(uuid, jsonb, text) from public;
grant execute on function public.resubmit_load_request(uuid, jsonb, text) to authenticated;

-- 4) Conversão em carga ----------------------------------------------------------

create or replace function public.convert_load_request_to_load(p_request_id uuid)
returns table(load_id uuid, codigo_interno text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
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
    prioridade, solicitante_id, observacoes, status, faturamento_estimado, data_agendada
  ) values (
    v_request.tipo, v_request.empresa_id, v_request.canal_id, v_request.marketplace_id, v_request.destino_full_id, v_request.loja_destino_id,
    v_request.prioridade, v_request.solicitante_id, v_request.observacoes, 'Aprovada',
    coalesce(
      v_request.faturamento_estimado,
      (select nullif(sum(coalesce(p.preco_venda, 0) * ri.quantidade), 0)
       from public.load_request_items ri
       left join public.products p on p.id = ri.product_id or (ri.product_id is null and p.sku = ri.sku)
       where ri.request_id = p_request_id)
    ),
    v_request.data_desejada
  ) returning id, codigo_interno into v_new_load_id, v_new_code;

  -- Itens: completa CMV, fornecedor, peso e medidas com o cadastro do produto
  -- (quem solicita normalmente só informa SKU, nome e quantidade).
  insert into public.load_items (
    load_id, product_id, sku, nome_produto, quantidade, fornecedor_origem_id, cmv_unitario,
    peso, altura, largura, profundidade, data_prevista_recebimento, observacao
  )
  select
    v_new_load_id,
    coalesce(ri.product_id, p.id),
    ri.sku,
    ri.nome_produto,
    ri.quantidade,
    coalesce(ri.fornecedor_origem_id, p.fornecedor_id),
    coalesce(nullif(ri.cmv_unitario, 0), p.cmv, 0),
    p.peso,
    p.altura,
    p.largura,
    p.profundidade,
    ri.data_prevista_recebimento,
    ri.observacao
  from public.load_request_items ri
  left join lateral (
    select * from public.products pp
    where pp.id = ri.product_id or (ri.product_id is null and pp.sku = ri.sku)
    limit 1
  ) p on true
  where ri.request_id = p_request_id;

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

-- 5) Status da operação do estoque ------------------------------------------------

create or replace function public.set_load_operational_status_from_checklist(p_load_id uuid, p_status text)
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

  if p_status not in ('Agendada','Separando','Pronta para coleta','Carregada','Em trânsito','Entregue','Finalizada') then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;

  select * into v_load from public.loads where id = p_load_id for update;
  if v_load.id is null then
    raise exception 'LOAD_NOT_FOUND' using errcode = 'P0001';
  end if;

  if not public.can_view_load(v_load) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  if v_load.status = 'Cancelada' then
    raise exception 'LOAD_CANCELED' using errcode = 'P0001';
  end if;

  update public.loads
  set status = p_status,
      updated_at = now()
  where id = p_load_id;

  insert into public.audit_logs(tabela, registro_id, acao, payload, profile_id)
  values ('loads', p_load_id, 'LOAD_OPERATIONAL_STATUS', jsonb_build_object('previous_status', v_load.status, 'new_status', p_status), v_profile.id);
end;
$$;
