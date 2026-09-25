-- Fornecedores: junta duplicados e padroniza os nomes.
-- 1) normalize_supplier_name ignora apóstrofo ("KIT'S" = "KITS") e "empresa".
-- 2) supplier_names_match também reconhece nomes iguais sem espaço
--    ("TECNO MOBILI" = "TECNOMOBILI").
-- 3) supplier_display_name: nome curto e legível para fornecedores novos
--    ("FLAMINGO INDUSTRIA E COMERCIO DE MOVEIS LTDA" -> "Flamingo"); a
--    importação cadastra com ele.
-- 4) Junta Kit's Paraná e Tecno Mobili e renomeia os cadastros atuais.

create or replace function public.normalize_supplier_name(p_name text)
returns text
language sql
immutable
as $$
  select trim(regexp_replace(
    regexp_replace(
      regexp_replace(
        translate(lower(replace(replace(coalesce(p_name, ''), '''', ''), '’', '')), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'),
        '[^a-z0-9]+', ' ', 'g'
      ),
      '\m(ltda|me|epp|eireli|sa|cia|industria|industrias|ind|fabrica|comercio|comercial|moveis|movel|empresa|de|do|da|dos|das|e)\M', ' ', 'g'
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
    when replace(p_a, ' ', '') = replace(p_b, ' ', '') then true
    when length(p_a) >= 3 and p_b like p_a || ' %' then true
    when length(p_b) >= 3 and p_a like p_b || ' %' then true
    else false
  end;
$$;

create or replace function public.supplier_display_name(p_name text)
returns text
language plpgsql
immutable
as $$
declare
  v_generic constant text[] := array['ltda', 'me', 'epp', 'eireli', 'sa', 'cia', 'industria', 'industrias', 'ind', 'fabrica',
    'comercio', 'comercial', 'moveis', 'movel', 'empresa', 'importadora', 'exportadora'];
  v_connectors constant text[] := array['de', 'do', 'da', 'dos', 'das', 'e', ''];
  v_words text[] := '{}';
  v_word text;
  v_key text;
  v_after_generic boolean := false;
  v_all_upper boolean;
  v_result text;
begin
  if coalesce(trim(p_name), '') = '' then
    return null;
  end if;
  v_all_upper := p_name = upper(p_name);

  foreach v_word in array regexp_split_to_array(trim(p_name), '\s+') loop
    v_key := translate(lower(regexp_replace(v_word, '[^[:alnum:]]', '', 'g')), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn');
    if v_key = any(v_generic) then
      -- "INDUSTRIA E COMERCIO DE MOVEIS": some a palavra e os conectores em volta.
      while cardinality(v_words) > 0
        and translate(lower(regexp_replace(v_words[cardinality(v_words)], '[^[:alnum:]]', '', 'g')), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn') = any(v_connectors) loop
        v_words := v_words[1:cardinality(v_words) - 1];
      end loop;
      v_after_generic := true;
    elsif v_key = any(v_connectors) and (v_after_generic or cardinality(v_words) = 0) then
      continue;
    else
      v_after_generic := false;
      v_words := v_words || v_word;
    end if;
  end loop;

  while cardinality(v_words) > 0
    and translate(lower(regexp_replace(v_words[cardinality(v_words)], '[^[:alnum:]]', '', 'g')), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn') = any(v_connectors) loop
    v_words := v_words[1:cardinality(v_words) - 1];
  end loop;

  -- Tudo em maiúsculas: "J SERRANO" -> "J Serrano"; siglas curtas sem vogal
  -- (MGM, THB) ficam como estão.
  if v_all_upper then
    for i in 1 .. coalesce(cardinality(v_words), 0) loop
      v_key := lower(regexp_replace(v_words[i], '[^[:alnum:]]', '', 'g'));
      if v_key = any(v_connectors) then
        v_words[i] := lower(v_words[i]);
      elsif not (length(v_key) <= 3 and v_key !~ '[aeiouáéíóúâêôãõ]') then
        v_words[i] := initcap(lower(v_words[i]));
      end if;
    end loop;
  end if;

  v_result := array_to_string(v_words, ' ');
  if coalesce(v_result, '') = ''
     or not public.supplier_names_match(public.normalize_supplier_name(v_result), public.normalize_supplier_name(p_name)) then
    return trim(p_name);
  end if;
  return v_result;
end;
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

  -- Fornecedor/fabricante: coluna Fornecedor ou, se vazia, a Marca do
  -- produto. O reconhecimento (match_supplier) roda uma vez por nome
  -- distinto, não por linha: uma planilha tem poucas dezenas de fabricantes.
  drop table if exists tmp_import_suppliers;
  create temp table tmp_import_suppliers on commit drop as
  select distinct public.product_supplier_name(e->>'fornecedor', e->>'marca') as nome, null::uuid as supplier_id
  from jsonb_array_elements(p_rows) e;
  delete from tmp_import_suppliers where nome is null or public.normalize_supplier_name(nome) = '';

  update tmp_import_suppliers set supplier_id = public.match_supplier(nome) where nome is not null;

  -- Fornecedor novo entra com o nome curto ("Flamingo", não a razão social).
  insert into public.suppliers (nome)
  select distinct on (public.normalize_supplier_name(nome)) public.supplier_display_name(nome)
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

-- 4a) Junta duplicados (mantém o mais antigo) ------------------------------------
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
        and (k.created_at, k.id) < (dup.created_at, dup.id)
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

-- 4b) Nomes padronizados ---------------------------------------------------------
do $rename$
declare
  v_bad text;
begin
  create temp table tmp_supplier_names (old text, new text) on commit drop;
  insert into tmp_supplier_names (old, new) values
    ('J SERRANO', 'J Serrano'),
    ('FLAMINGO INDUSTRIA E COMERCIO DE MOVEIS LTDA', 'Flamingo'),
    ('SARA DECORAÇÕES', 'Sara Decorações'),
    ('MGM MOVEIS', 'MGM'),
    ('DOBUE MOVELARIA', 'Dobue Movelaria'),
    ('LINEA BRASIL', 'Linea Brasil'),
    ('INDUSTRIA DE MOVEIS BECHARA NASSAR LTDA', 'Bechara Nassar'),
    ('KAPPESBERG', 'Kappesberg'),
    ('HIPERTEXTIL', 'Hipertextil'),
    ('CARRARO', 'Carraro'),
    ('GOODS', 'Goods'),
    ('MX INDUSTRIA E COMERCIO DE MOVEIS LTDA', 'MX'),
    ('DUNAMIS MOVEIS LTDA', 'Dunamis'),
    ('SEIVA MOVEIS', 'Seiva'),
    ('CASA D', 'Casa D'),
    ('J CARVALHO MOVEIS LTDA', 'J Carvalho'),
    ('SAO CARLOS', 'São Carlos'),
    ('DORIPEL', 'Doripel'),
    ('TEXTIL SÃO JOAO', 'Têxtil São João'),
    ('MSUL', 'MSul'),
    ('NACIONAL MOVEIS', 'Nacional'),
    ('REFINATTO', 'Refinatto'),
    ('MOVEIS CASTRO LTDA', 'Castro'),
    ('RIVATTI', 'Rivatti'),
    ('FRATINI', 'Fratini'),
    ('ARTELY', 'Artely'),
    ('ATIVA MOVEIS', 'Ativa'),
    ('TAY INDUSTRIA E COMERCIO DE MO', 'Tay'),
    ('DORIGON MOVEIS', 'Dorigon'),
    ('WANG & CIA', 'Wang'),
    ('LIZIL', 'Lizil'),
    ('JAELI MOVEIS', 'Jaeli'),
    ('RUD RACK', 'Rud Rack'),
    ('IBM MOVEIS', 'IBM'),
    ('TECELAGEM ATLANTICA', 'Tecelagem Atlântica'),
    ('MÓVEIS LANZA', 'Lanza'),
    ('LIVINTUS/FERGUILE', 'Livintus/Ferguile'),
    ('SOLUZIONE', 'Soluzione'),
    ('MOLDUQUADROS', 'Molduquadros'),
    ('RUDNICK', 'Rudnick'),
    ('NOIA ESTOFADOS', 'Noia Estofados'),
    ('GRIFF ARTES', 'Griff Artes'),
    ('CRISTALFLEX COLCHÕES', 'Cristalflex Colchões'),
    ('ARTESANO', 'Artesano'),
    ('MOVEIS ARMIL', 'Armil'),
    ('JB BECHARA', 'JB Bechara'),
    ('FAIMEC', 'Faimec'),
    ('FACTHUS INTERNATIONAL IMPORTADORA E EXPORTADORA LTDA', 'Facthus'),
    ('ESTOFADOS SANTA HELENA LTDA', 'Estofados Santa Helena'),
    ('KIT''S PARANA', 'Kits Paraná'),
    ('KITS PARANA', 'Kits Paraná'),
    ('CRIELUS INDUSTRIA E COMERCIO DE MOVEIS E ESTOFADOS LTDA', 'Crielus'),
    ('CLAUDIA TEREZINHA QUESSADA', 'Claudia Terezinha Quessada'),
    ('LESSENCE', 'Lessence'),
    ('TEMPERSIONOS', 'Tempersionos'),
    ('COMPOARTE ARTEFATOS DE ARAME LTDA - EPP', 'Compoarte'),
    ('MAKOGLAS', 'Makoglas'),
    ('BELLA ARTE DECOR', 'Bella Arte Decor'),
    ('RODRIGO DE MELLO', 'Rodrigo de Mello'),
    ('ILHA BELA', 'Ilha Bela'),
    ('DIVINO QUADROS', 'Divino Quadros'),
    ('ARTMAD LTDA', 'Artmad'),
    ('MOVEIS NIRUMA', 'Niruma'),
    ('GRP MOBILE', 'GRP Mobile'),
    ('PEDROTTI', 'Pedrotti'),
    ('PREVILEGE  MOVEIS', 'Previlege'),
    ('GRAPPA', 'Grappa'),
    ('NOTÁVEL MOVEIS', 'Notável'),
    ('VIERO', 'Viero'),
    ('SPLENDORE INDUSTRIA', 'Splendore'),
    ('CIMOL', 'Cimol'),
    ('CAEMMUN', 'Caemmun'),
    ('HEH DECORAÇÕES', 'HEH Decorações'),
    ('HAPPY', 'Happy'),
    ('ESTRELA', 'Estrela'),
    ('ACR INDUSTRIA DE MOVEIS', 'ACR'),
    ('RANCI ESTOFADOS', 'Ranci Estofados'),
    ('MOL - IND. DO PLASTICO REFORCADO LTDA', 'MOL'),
    ('FABRICA DE MOVEIS RORATO', 'Rorato'),
    ('Be Mobiliário inteligente', 'Be Mobiliário Inteligente'),
    ('RM LEATHER', 'RM Leather'),
    ('FAMA', 'Fama'),
    ('FORMATORI MOVEIS', 'Formatori'),
    ('BST MOVEIS', 'BST'),
    ('SORENTO HOME LTDA', 'Sorento Home'),
    ('MENEGAZ MOVEIS', 'Menegaz'),
    ('ESTFLEX', 'Estflex'),
    ('MOBLER MOVEIS', 'Mobler'),
    ('PRIME DECOR', 'Prime Decor'),
    ('GELIUS', 'Gelius'),
    ('MEYER', 'Meyer'),
    ('MAJOKA MOVEIS', 'Majoka'),
    ('PONZONI', 'Ponzoni'),
    ('UMAFLEX', 'Umaflex'),
    ('FD TAPETES', 'FD Tapetes'),
    ('EJ MOVEIS', 'EJ'),
    ('MGS MOVEIS', 'MGS'),
    ('TECNO MOBILI', 'Tecno Mobili'),
    ('TECNOMOBILI MOVEIS', 'Tecno Mobili'),
    ('MOVEIS PRIMAVERA LTDA', 'Primavera'),
    ('GAZIN', 'Gazin'),
    ('BENTEC', 'Bentec'),
    ('INSPIRARE MOVEIS', 'Inspirare'),
    ('OFICIAL WEBSHOP COMERCIO DE PRODUTOS ESPECIAIS LTDA', 'Oficial Webshop'),
    ('MATRIX', 'Matrix'),
    ('ART. PANTA', 'Art. Panta'),
    ('EDER', 'Eder'),
    ('HENN', 'Henn'),
    ('PRORELAX', 'Prorelax'),
    ('NILSON', 'Nilson'),
    ('DRAFMIL', 'Drafmil'),
    ('BELINI MOVEIS', 'Belini'),
    ('TECNOMOBILI MOVEIS', 'Tecno Mobili'),
    ('TFH INDUSTRIA', 'TFH'),
    ('SOLAR MOVEIS', 'Solar'),
    ('HUGO SCHUSTER', 'Hugo Schuster'),
    ('SERFLEX', 'Serflex'),
    ('BERFLEX', 'Berflex'),
    ('STM MOVEIS', 'STM'),
    ('SOMOPAR', 'Somopar'),
    ('INOX DO VALE', 'Inox do Vale'),
    ('ANGELITA LOPES', 'Angelita Lopes'),
    ('ANGELA', 'Angela'),
    ('MENEGHETTI', 'Meneghetti'),
    ('CONEXAO DO SONO', 'Conexão do Sono'),
    ('VOLTARELI', 'Voltareli'),
    ('KETER', 'Keter'),
    ('GHELPLUS', 'Ghelplus'),
    ('EMPRESA FRAMAR MOVEIS', 'Framar'),
    ('SOU DE CORAÇÃO', 'Sou de Coração'),
    ('DL REPRESENTAÇÕES', 'DL Representações'),
    ('REGNER', 'Regner'),
    ('RENOVA MOVEIS', 'Renova'),
    ('IMD COMERCIO DE MOVEIS LTDA', 'IMD'),
    ('SPAZZIO NOBRE', 'Spazzio Nobre'),
    ('BRESSIANI', 'Bressiani'),
    ('JAC INDUSTRIA', 'JAC'),
    ('FRIBASCA', 'Fribasca'),
    ('MOVEIS EUROPA', 'Europa'),
    ('METTA MOBILI', 'Metta Mobili'),
    ('DOBUE/FORMATORI', 'Dobue/Formatori');

  -- Segurança: o nome novo tem que continuar sendo reconhecido como o antigo
  -- nas próximas importações.
  select string_agg(old, ', ') into v_bad
  from (select distinct old, new from tmp_supplier_names) t
  where not public.supplier_names_match(public.normalize_supplier_name(new), public.normalize_supplier_name(old));
  if v_bad is not null then
    raise exception 'Nome padronizado não reconhece o original: %', v_bad;
  end if;

  update public.suppliers s
  set nome = t.new
  from (select distinct old, new from tmp_supplier_names) t
  where s.nome = t.old and s.nome <> t.new;
end
$rename$;
