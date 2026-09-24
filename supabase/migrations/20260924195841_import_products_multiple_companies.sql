-- Importação de produtos para várias empresas de uma vez (ex.: filiais).
-- import_products_for_companies recebe a lista de empresas; a versão antiga
-- (uma empresa) passa a chamar a nova, para manter compatibilidade.

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

revoke all on function public.import_products_for_companies(uuid[], jsonb) from public;
grant execute on function public.import_products_for_companies(uuid[], jsonb) to authenticated;

create or replace function public.import_products_for_company(
  p_company_id uuid,
  p_rows jsonb
)
returns table(created integer, updated integer, linked integer, skipped integer)
language sql
security definer
set search_path = public
as $$
  select * from public.import_products_for_companies(array[p_company_id], p_rows);
$$;
