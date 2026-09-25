-- Importação de produtos mais rápida: o reconhecimento de fornecedor
-- (match_supplier, ~4 ms) rodava duas vezes por linha e estourava o tempo
-- limite com 1.000 linhas quando a Marca vem preenchida. Agora roda uma vez
-- por nome distinto da planilha.

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

  -- Fornecedor/fabricante: coluna Fornecedor ou, se vazia, a Marca do
  -- produto. O reconhecimento (match_supplier) roda uma vez por nome
  -- distinto, não por linha: uma planilha tem poucas dezenas de fabricantes.
  drop table if exists tmp_import_suppliers;
  create temp table tmp_import_suppliers on commit drop as
  select distinct public.product_supplier_name(e->>'fornecedor', e->>'marca') as nome, null::uuid as supplier_id
  from jsonb_array_elements(p_rows) e;
  delete from tmp_import_suppliers where nome is null or public.normalize_supplier_name(nome) = '';

  update tmp_import_suppliers set supplier_id = public.match_supplier(nome);

  insert into public.suppliers (nome)
  select distinct on (public.normalize_supplier_name(nome)) nome
  from tmp_import_suppliers
  where supplier_id is null
  order by public.normalize_supplier_name(nome), length(nome), nome
  on conflict (nome) do nothing;

  update tmp_import_suppliers set supplier_id = public.match_supplier(nome) where supplier_id is null;

  drop table if exists tmp_import_products;
  create temp table tmp_import_products on commit drop as
  select distinct on (r.sku)
    r.sku,
    r.nome,
    case when r.cmv > 0 then r.cmv else null end as cmv,
    s.supplier_id as fornecedor_id,
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
  left join tmp_import_suppliers s on s.nome = r.fornecedor
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
