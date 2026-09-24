-- Produtos: medidas/peso da embalagem, edição individual, ações em massa e
-- exclusão.
-- 1) products ganha peso (kg) e altura/largura/profundidade (cm), os mesmos
--    campos de load_items, para preencher os itens da carga.
-- 2) get_visible_products / _page / _by_sku devolvem os campos novos (e o
--    fornecedor e as empresas, para edição e preenchimento automático).
-- 3) import_products_for_companies grava peso e medidas (> 0 não sobrescreve
--    com vazio, como o CMV).
-- 4) update_product, bulk_update_products, delete_products e
--    get_visible_product_ids (seleção de todos os produtos de um filtro).

alter table public.products add column if not exists peso numeric;
alter table public.products add column if not exists altura numeric;
alter table public.products add column if not exists largura numeric;
alter table public.products add column if not exists profundidade numeric;

-- 2) Leitura -----------------------------------------------------------------

drop function if exists public.get_visible_products_page(integer, integer, text, uuid);
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
  supplier_name text,
  peso numeric,
  altura numeric,
  largura numeric,
  profundidade numeric
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
    s.nome as supplier_name,
    p.peso,
    p.altura,
    p.largura,
    p.profundidade
  from public.products p
  left join public.suppliers s on s.id = p.fornecedor_id
  where auth.uid() is not null
  order by p.nome asc;
$$;

revoke all on function public.get_visible_products() from public;
grant execute on function public.get_visible_products() to authenticated;

create or replace function public.get_visible_products_page(
  p_page integer default 1,
  p_page_size integer default 50,
  p_search text default null,
  p_company_id uuid default null
)
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
  supplier_name text,
  peso numeric,
  altura numeric,
  largura numeric,
  profundidade numeric,
  company_names text,
  company_ids uuid[],
  total_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    gp.*,
    (
      select string_agg(c.nome, ', ' order by c.nome)
      from public.product_companies pc
      join public.companies c on c.id = pc.company_id
      where pc.product_id = gp.id
    ) as company_names,
    (
      select array_agg(pc.company_id)
      from public.product_companies pc
      where pc.product_id = gp.id
    ) as company_ids,
    count(*) over() as total_count
  from public.get_visible_products() gp
  where (
      nullif(trim(p_search), '') is null
      or gp.sku ilike '%' || trim(p_search) || '%'
      or gp.nome ilike '%' || trim(p_search) || '%'
    )
    and (
      p_company_id is null
      or exists (
        select 1 from public.product_companies pc
        where pc.product_id = gp.id and pc.company_id = p_company_id
      )
    )
  limit greatest(1, least(coalesce(p_page_size, 50), 100))
  offset greatest(0, coalesce(p_page, 1) - 1) * greatest(1, least(coalesce(p_page_size, 50), 100));
$$;

revoke all on function public.get_visible_products_page(integer, integer, text, uuid) from public;
grant execute on function public.get_visible_products_page(integer, integer, text, uuid) to authenticated;

-- Todos os IDs de um filtro (para "selecionar todos" nas ações em massa).
create or replace function public.get_visible_product_ids(
  p_search text default null,
  p_company_id uuid default null
)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.products p
  where auth.uid() is not null
    and (
      nullif(trim(p_search), '') is null
      or p.sku ilike '%' || trim(p_search) || '%'
      or p.nome ilike '%' || trim(p_search) || '%'
    )
    and (
      p_company_id is null
      or exists (
        select 1 from public.product_companies pc
        where pc.product_id = p.id and pc.company_id = p_company_id
      )
    );
$$;

revoke all on function public.get_visible_product_ids(text, uuid) from public;
grant execute on function public.get_visible_product_ids(text, uuid) to authenticated;

drop function if exists public.get_visible_product_by_sku(text, uuid);

create or replace function public.get_visible_product_by_sku(
  p_sku text,
  p_company_id uuid default null
)
returns table (
  id uuid,
  nome text,
  cmv numeric,
  fornecedor_id uuid,
  peso numeric,
  altura numeric,
  largura numeric,
  profundidade numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.nome,
    case when public.can_view_financial() then p.cmv else null end,
    p.fornecedor_id,
    p.peso,
    p.altura,
    p.largura,
    p.profundidade
  from public.products p
  where auth.uid() is not null
    and p.sku = p_sku
    and (
      p_company_id is null
      or exists (
        select 1 from public.product_companies pc
        where pc.product_id = p.id and pc.company_id = p_company_id
      )
    )
  limit 1;
$$;

revoke all on function public.get_visible_product_by_sku(text, uuid) from public;
grant execute on function public.get_visible_product_by_sku(text, uuid) to authenticated;

-- 3) Importação com peso e medidas --------------------------------------------

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
    case when r.profundidade > 0 then r.profundidade else null end as profundidade
  from (
    select
      trim(e->>'sku') as sku,
      trim(e->>'nome') as nome,
      nullif(e->>'cmv', '')::numeric as cmv,
      nullif(trim(e->>'fornecedor'), '') as fornecedor,
      nullif(e->>'peso', '')::numeric as peso,
      nullif(e->>'altura', '')::numeric as altura,
      nullif(e->>'largura', '')::numeric as largura,
      nullif(e->>'profundidade', '')::numeric as profundidade
    from jsonb_array_elements(p_rows) e
  ) r
  left join public.suppliers s on lower(s.nome) = lower(r.fornecedor)
  where coalesce(r.sku, '') <> '' and coalesce(r.nome, '') <> ''
  -- SKU repetido na planilha: vale a linha com custo preenchido.
  order by r.sku, (r.cmv > 0) desc nulls last;

  select count(*) into v_valid from tmp_import_products;

  with upserted as (
    insert into public.products (sku, nome, cmv, fornecedor_id, peso, altura, largura, profundidade, last_synced_at)
    select sku, nome, coalesce(cmv, 0), fornecedor_id, peso, altura, largura, profundidade, v_now
    from tmp_import_products
    on conflict (sku) do update
      set nome = excluded.nome,
          cmv = case when excluded.cmv > 0 then excluded.cmv else products.cmv end,
          fornecedor_id = coalesce(excluded.fornecedor_id, products.fornecedor_id),
          peso = coalesce(excluded.peso, products.peso),
          altura = coalesce(excluded.altura, products.altura),
          largura = coalesce(excluded.largura, products.largura),
          profundidade = coalesce(excluded.profundidade, products.profundidade),
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

-- 4) Edição, ações em massa e exclusão ------------------------------------------

create or replace function public.require_product_manager()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED' using errcode = 'P0001';
  end if;

  select id into v_profile_id
  from public.users_profile
  where auth_user_id = auth.uid() and ativo = true and perfil in ('admin', 'gerente_estoque')
  limit 1;

  if v_profile_id is null then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  return v_profile_id;
end;
$$;

revoke all on function public.require_product_manager() from public;

-- p_patch: só as chaves presentes são alteradas. Aceita sku, nome, cmv,
-- fornecedor_id, ativo, peso, altura, largura, profundidade e company_ids
-- (lista completa de empresas do produto).
create or replace function public.update_product(p_id uuid, p_patch jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.require_product_manager();
  v_before public.products%rowtype;
  v_sku text;
  v_nome text;
begin
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'INVALID_PAYLOAD' using errcode = 'P0001';
  end if;

  select * into v_before from public.products where id = p_id for update;
  if v_before.id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  if p_patch ? 'sku' then
    v_sku := trim(coalesce(p_patch->>'sku', ''));
    if v_sku = '' then
      raise exception 'SKU_REQUIRED' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.products where sku = v_sku and id <> p_id) then
      raise exception 'SKU_ALREADY_EXISTS' using errcode = 'P0001';
    end if;
  end if;

  if p_patch ? 'nome' then
    v_nome := trim(coalesce(p_patch->>'nome', ''));
    if v_nome = '' then
      raise exception 'FIELD_REQUIRED' using errcode = 'P0001';
    end if;
  end if;

  update public.products set
    sku = case when p_patch ? 'sku' then v_sku else sku end,
    nome = case when p_patch ? 'nome' then v_nome else nome end,
    cmv = case when p_patch ? 'cmv' then greatest(coalesce(nullif(p_patch->>'cmv', '')::numeric, 0), 0) else cmv end,
    fornecedor_id = case when p_patch ? 'fornecedor_id' then nullif(p_patch->>'fornecedor_id', '')::uuid else fornecedor_id end,
    ativo = case when p_patch ? 'ativo' then coalesce((p_patch->>'ativo')::boolean, ativo) else ativo end,
    peso = case when p_patch ? 'peso' then nullif(p_patch->>'peso', '')::numeric else peso end,
    altura = case when p_patch ? 'altura' then nullif(p_patch->>'altura', '')::numeric else altura end,
    largura = case when p_patch ? 'largura' then nullif(p_patch->>'largura', '')::numeric else largura end,
    profundidade = case when p_patch ? 'profundidade' then nullif(p_patch->>'profundidade', '')::numeric else profundidade end
  where id = p_id;

  if p_patch ? 'company_ids' then
    if jsonb_typeof(p_patch->'company_ids') <> 'array' then
      raise exception 'INVALID_PAYLOAD' using errcode = 'P0001';
    end if;
    delete from public.product_companies
    where product_id = p_id
      and company_id not in (select (value #>> '{}')::uuid from jsonb_array_elements(p_patch->'company_ids'));
    insert into public.product_companies (product_id, company_id)
    select p_id, (value #>> '{}')::uuid
    from jsonb_array_elements(p_patch->'company_ids')
    on conflict do nothing;
  end if;

  insert into public.audit_logs(tabela, registro_id, acao, payload, profile_id)
  values ('products', p_id, 'PRODUCT_UPDATED', jsonb_build_object('before', to_jsonb(v_before), 'patch', p_patch), v_profile_id);
end;
$$;

revoke all on function public.update_product(uuid, jsonb) from public;
grant execute on function public.update_product(uuid, jsonb) to authenticated;

-- p_patch aceita fornecedor_id, cmv, ativo, add_company_ids e
-- remove_company_ids. Devolve quantos produtos foram alterados.
create or replace function public.bulk_update_products(p_ids uuid[], p_patch jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.require_product_manager();
  v_count integer;
begin
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' or coalesce(cardinality(p_ids), 0) = 0 then
    raise exception 'INVALID_PAYLOAD' using errcode = 'P0001';
  end if;

  update public.products set
    cmv = case when p_patch ? 'cmv' then greatest(coalesce(nullif(p_patch->>'cmv', '')::numeric, 0), 0) else cmv end,
    fornecedor_id = case when p_patch ? 'fornecedor_id' then nullif(p_patch->>'fornecedor_id', '')::uuid else fornecedor_id end,
    ativo = case when p_patch ? 'ativo' then coalesce((p_patch->>'ativo')::boolean, ativo) else ativo end
  where id = any(p_ids);
  get diagnostics v_count = row_count;

  if jsonb_typeof(p_patch->'add_company_ids') = 'array' then
    insert into public.product_companies (product_id, company_id)
    select p.id, (c.value #>> '{}')::uuid
    from public.products p
    cross join jsonb_array_elements(p_patch->'add_company_ids') c
    where p.id = any(p_ids)
    on conflict do nothing;
  end if;

  if jsonb_typeof(p_patch->'remove_company_ids') = 'array' then
    delete from public.product_companies
    where product_id = any(p_ids)
      and company_id in (select (value #>> '{}')::uuid from jsonb_array_elements(p_patch->'remove_company_ids'));
  end if;

  insert into public.audit_logs(tabela, registro_id, acao, payload, profile_id)
  values ('products', null, 'PRODUCTS_BULK_UPDATED', jsonb_build_object('ids', to_jsonb(p_ids), 'patch', p_patch, 'count', v_count), v_profile_id);

  return v_count;
end;
$$;

revoke all on function public.bulk_update_products(uuid[], jsonb) from public;
grant execute on function public.bulk_update_products(uuid[], jsonb) to authenticated;

-- Exclui os produtos sem uso; os que já aparecem em cargas ou solicitações
-- são inativados (o histórico continua apontando para eles).
create or replace function public.delete_products(p_ids uuid[])
returns table(deleted integer, deactivated integer)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_profile_id uuid := public.require_product_manager();
  v_deleted integer;
  v_deactivated integer;
begin
  if coalesce(cardinality(p_ids), 0) = 0 then
    raise exception 'INVALID_PAYLOAD' using errcode = 'P0001';
  end if;

  update public.products p set ativo = false
  where p.id = any(p_ids)
    and (
      exists (select 1 from public.load_items li where li.product_id = p.id)
      or exists (select 1 from public.load_request_items ri where ri.product_id = p.id)
    );
  get diagnostics v_deactivated = row_count;

  delete from public.products p
  where p.id = any(p_ids)
    and not exists (select 1 from public.load_items li where li.product_id = p.id)
    and not exists (select 1 from public.load_request_items ri where ri.product_id = p.id);
  get diagnostics v_deleted = row_count;

  insert into public.audit_logs(tabela, registro_id, acao, payload, profile_id)
  values ('products', null, 'PRODUCTS_DELETED', jsonb_build_object('ids', to_jsonb(p_ids), 'deleted', v_deleted, 'deactivated', v_deactivated), v_profile_id);

  return query select v_deleted, v_deactivated;
end;
$$;

revoke all on function public.delete_products(uuid[]) from public;
grant execute on function public.delete_products(uuid[]) to authenticated;
