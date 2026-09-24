-- Produtos por empresa + importação por planilha.
-- 1) product_companies: um produto (SKU único) pode pertencer a várias empresas.
-- 2) import_products_for_company: upsert dos produtos da planilha (ERP) e
--    vínculo com a empresa escolhida, numa única transação.
-- 3) get_visible_products_page: filtro opcional por empresa e lista de
--    empresas de cada produto.

create table if not exists public.product_companies (
  product_id uuid not null references public.products(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (product_id, company_id)
);

create index if not exists idx_product_companies_company_id on public.product_companies(company_id);

alter table public.product_companies enable row level security;

drop policy if exists "product_companies_select" on public.product_companies;
drop policy if exists "product_companies_insert" on public.product_companies;
drop policy if exists "product_companies_delete" on public.product_companies;

create policy "product_companies_select"
on public.product_companies
for select
using (auth.uid() is not null);

create policy "product_companies_insert"
on public.product_companies
for insert
with check (public.current_user_role() in ('admin', 'gerente_estoque'));

create policy "product_companies_delete"
on public.product_companies
for delete
using (public.current_user_role() in ('admin', 'gerente_estoque'));

-- p_rows: [{ "sku": "...", "nome": "...", "cmv": 12.34, "fornecedor": "..." }]
-- CMV <= 0 ou ausente não sobrescreve um CMV já cadastrado. O fornecedor só é
-- vinculado quando o nome bate (sem diferenciar maiúsculas) com um cadastrado.
create or replace function public.import_products_for_company(
  p_company_id uuid,
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

  if p_company_id is null then
    raise exception 'EMPRESA_REQUIRED' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.companies where id = p_company_id) then
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
    s.id as fornecedor_id
  from (
    select
      trim(e->>'sku') as sku,
      trim(e->>'nome') as nome,
      nullif(e->>'cmv', '')::numeric as cmv,
      nullif(trim(e->>'fornecedor'), '') as fornecedor
    from jsonb_array_elements(p_rows) e
  ) r
  left join public.suppliers s on lower(s.nome) = lower(r.fornecedor)
  where coalesce(r.sku, '') <> '' and coalesce(r.nome, '') <> ''
  -- SKU repetido na planilha: vale a linha com custo preenchido.
  order by r.sku, (r.cmv > 0) desc nulls last;

  select count(*) into v_valid from tmp_import_products;

  with upserted as (
    insert into public.products (sku, nome, cmv, fornecedor_id, last_synced_at)
    select sku, nome, coalesce(cmv, 0), fornecedor_id, v_now
    from tmp_import_products
    on conflict (sku) do update
      set nome = excluded.nome,
          cmv = case when excluded.cmv > 0 then excluded.cmv else products.cmv end,
          fornecedor_id = coalesce(excluded.fornecedor_id, products.fornecedor_id),
          last_synced_at = excluded.last_synced_at
    returning (xmax = 0) as inserted
  )
  select count(*) filter (where inserted) into v_created from upserted;

  with ins as (
    insert into public.product_companies (product_id, company_id)
    select p.id, p_company_id
    from public.products p
    join tmp_import_products t on t.sku = p.sku
    on conflict (product_id, company_id) do nothing
    returning 1
  )
  select count(*) into v_linked from ins;

  insert into public.audit_logs(tabela, registro_id, acao, payload, profile_id)
  values (
    'companies',
    p_company_id,
    'PRODUCTS_IMPORTED',
    jsonb_build_object('rows', v_total, 'valid', v_valid, 'created', v_created, 'linked', v_linked),
    v_profile.id
  );

  return query select v_created, v_valid - v_created, v_linked, v_total - v_valid;
end;
$$;

revoke all on function public.import_products_for_company(uuid, jsonb) from public;
grant execute on function public.import_products_for_company(uuid, jsonb) to authenticated;

drop function if exists public.get_visible_products_page(integer, integer, text);

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
  company_names text,
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
