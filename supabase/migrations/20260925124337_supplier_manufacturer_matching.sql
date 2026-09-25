-- Fornecedor = fabricante.
-- 1) normalize_supplier_name também ignora "fábrica", "ind.", "comercial".
-- 2) match_supplier: reconhece o cadastro pelo nome normalizado igual ou
--    quando um nome começa com o outro ("Herval" ↔ "HERVAL INDUSTRIA DE
--    MOVEIS COLCHOES ESPUMAS LTDA"); prefere o igual e o mais antigo.
-- 3) product_supplier_name: usa a coluna Fornecedor ou, se vazia, a Marca do
--    Olist (fabricante), ignorando marcas genéricas.
-- 4) import_products_for_companies usa as duas funções.
-- 5) Junta fornecedores duplicados (mesmo nome normalizado ou um prefixo do
--    outro): mantém o mais antigo e repassa produtos e itens.

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
      '\m(ltda|me|epp|eireli|sa|cia|industria|industrias|ind|fabrica|comercio|comercial|moveis|movel|de|do|da|dos|das|e)\M', ' ', 'g'
    ),
    '\s+', ' ', 'g'
  ));
$$;

create or replace function public.supplier_names_match(p_a text, p_b text)
returns boolean
language sql
immutable
as $$
  select case
    when coalesce(p_a, '') = '' or coalesce(p_b, '') = '' then false
    when p_a = p_b then true
    when length(p_a) >= 3 and p_b like p_a || ' %' then true
    when length(p_b) >= 3 and p_a like p_b || ' %' then true
    else false
  end;
$$;

create or replace function public.match_supplier(p_name text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select s.id
  from public.suppliers s
  where public.supplier_names_match(public.normalize_supplier_name(s.nome), public.normalize_supplier_name(p_name))
  order by
    (public.normalize_supplier_name(s.nome) = public.normalize_supplier_name(p_name)) desc,
    s.ativo desc,
    s.created_at
  limit 1;
$$;

create or replace function public.product_supplier_name(p_fornecedor text, p_marca text)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(trim(p_fornecedor), ''),
    case
      when public.normalize_supplier_name(p_marca) in ('', 'outros', 'outro', 'assistencia', 'generico', 'generica', 'sem marca') then null
      else nullif(trim(p_marca), '')
    end
  );
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
  -- Fornecedor/fabricante: coluna Fornecedor ou, se vazia, a Marca do
  -- produto. Reconhece cadastros existentes (match_supplier) e cadastra os
  -- que faltam.
  insert into public.suppliers (nome)
  select distinct on (public.normalize_supplier_name(f.nome)) f.nome
  from (
    select public.product_supplier_name(e->>'fornecedor', e->>'marca') as nome
    from jsonb_array_elements(p_rows) e
  ) f
  where f.nome is not null
    and public.normalize_supplier_name(f.nome) <> ''
    and public.match_supplier(f.nome) is null
  order by public.normalize_supplier_name(f.nome), length(f.nome), f.nome
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
      public.product_supplier_name(e->>'fornecedor', e->>'marca') as fornecedor,
      nullif(e->>'peso', '')::numeric as peso,
      nullif(e->>'altura', '')::numeric as altura,
      nullif(e->>'largura', '')::numeric as largura,
      nullif(e->>'profundidade', '')::numeric as profundidade,
      nullif(e->>'preco_venda', '')::numeric as preco_venda
    from jsonb_array_elements(p_rows) e
  ) r
  left join lateral (select public.match_supplier(r.fornecedor) as id) s on true
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

-- 5) Junta duplicados ------------------------------------------------------------
do $merge$
declare
  v_pair record;
begin
  for v_pair in
    select dup.id as dup_id, keep.id as keep_id
    from public.suppliers dup
    join lateral (
      select k.id
      from public.suppliers k
      where k.id <> dup.id
        and k.created_at <= dup.created_at
        and public.supplier_names_match(public.normalize_supplier_name(k.nome), public.normalize_supplier_name(dup.nome))
      order by k.created_at, k.id
      limit 1
    ) keep on true
    order by dup.created_at desc
  loop
    if exists (select 1 from public.suppliers where id = v_pair.dup_id)
       and exists (select 1 from public.suppliers where id = v_pair.keep_id) then
      update public.products set fornecedor_id = v_pair.keep_id where fornecedor_id = v_pair.dup_id;
      update public.load_items set fornecedor_origem_id = v_pair.keep_id where fornecedor_origem_id = v_pair.dup_id;
      update public.load_request_items set fornecedor_origem_id = v_pair.keep_id where fornecedor_origem_id = v_pair.dup_id;
      delete from public.suppliers where id = v_pair.dup_id;
    end if;
  end loop;
end
$merge$;
