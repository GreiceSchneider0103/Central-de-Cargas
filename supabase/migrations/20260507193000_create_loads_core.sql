create table if not exists public.loads (
  id uuid primary key default gen_random_uuid(),
  codigo_interno text unique not null,
  numero_carga_marketplace text,
  codigo_agendamento text,
  tipo text not null,
  empresa_id uuid references public.companies(id),
  canal_id uuid references public.channels(id),
  marketplace_id uuid references public.channels(id),
  destino_full_id uuid references public.full_destinations(id),
  loja_destino_id uuid references public.stores(id),
  cd_origem_id uuid references public.distribution_centers(id),
  status text not null,
  prioridade text,
  data_agendada timestamptz,
  data_prevista_recebimento timestamptz,
  data_real_recebimento timestamptz,
  tipo_coleta_id uuid references public.transport_types(id),
  transportador_id uuid references public.transport_types(id),
  custo_frete numeric not null default 0,
  outros_custos numeric not null default 0,
  faturamento_estimado numeric,
  cmv_total numeric not null default 0,
  margem_estimativa_valor numeric,
  margem_estimativa_percentual numeric,
  solicitante_id uuid references public.users_profile(id),
  responsavel_operacional_id uuid references public.users_profile(id),
  observacoes text,
  cancelada_em timestamptz,
  cancelada_por uuid references public.users_profile(id),
  motivo_cancelamento text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.load_items (
  id uuid primary key default gen_random_uuid(),
  load_id uuid not null references public.loads(id) on delete cascade,
  product_id uuid references public.products(id),
  sku text not null,
  nome_produto text not null,
  quantidade numeric not null,
  fornecedor_origem_id uuid references public.suppliers(id),
  cmv_unitario numeric not null default 0,
  cmv_total numeric not null default 0,
  peso numeric,
  altura numeric,
  largura numeric,
  profundidade numeric,
  cubagem numeric,
  data_prevista_recebimento timestamptz,
  data_real_recebimento timestamptz,
  status_item text,
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.load_checklists (
  id uuid primary key default gen_random_uuid(),
  load_id uuid not null unique references public.loads(id) on delete cascade,
  pedido_realizado boolean not null default false,
  pedido_confirmado_fornecedor boolean not null default false,
  produto_recebido boolean not null default false,
  montada boolean not null default false,
  agendada boolean not null default false,
  etiqueta_impressa boolean not null default false,
  carga_separada boolean not null default false,
  carga_etiquetada boolean not null default false,
  nf_emitida boolean not null default false,
  carga_carregada boolean not null default false,
  finalizada boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  entidade text not null,
  entidade_id uuid not null,
  texto text not null,
  autor_profile_id uuid references public.users_profile(id),
  created_at timestamptz not null default now()
);

create or replace function public.generate_load_code(p_tipo text)
returns text language plpgsql as $$
declare
  year_txt text := to_char(now(),'YYYY');
  prefix text := case when p_tipo = 'FULL_MARKETPLACE' then 'FULL' else 'LOJA' end;
  seq_num int;
begin
  select count(*) + 1 into seq_num from public.loads where codigo_interno like prefix || '-' || year_txt || '-%';
  return prefix || '-' || year_txt || '-' || lpad(seq_num::text,4,'0');
end; $$;

create or replace function public.recalc_load_financial(p_load_id uuid)
returns void language plpgsql as $$
declare
  v_cmv numeric;
  v_fat numeric;
  v_frete numeric;
  v_outros numeric;
  v_margem numeric;
begin
  select coalesce(sum(cmv_total),0) into v_cmv from public.load_items where load_id = p_load_id;
  select faturamento_estimado, custo_frete, outros_custos into v_fat, v_frete, v_outros from public.loads where id = p_load_id;
  v_margem := coalesce(v_fat,0) - v_cmv - coalesce(v_frete,0) - coalesce(v_outros,0);
  update public.loads set
    cmv_total = v_cmv,
    margem_estimativa_valor = case when v_fat is null then null else v_margem end,
    margem_estimativa_percentual = case when coalesce(v_fat,0) > 0 then (v_margem / v_fat) else null end,
    updated_at = now()
  where id = p_load_id;
end; $$;

create or replace function public.before_load_item_save()
returns trigger language plpgsql as $$
begin
  new.cmv_total := coalesce(new.quantidade,0) * coalesce(new.cmv_unitario,0);
  if new.altura is not null and new.largura is not null and new.profundidade is not null then
    new.cubagem := new.altura * new.largura * new.profundidade;
  end if;
  new.updated_at := now();
  return new;
end; $$;

create or replace function public.after_load_item_change()
returns trigger language plpgsql as $$
begin
  perform public.recalc_load_financial(coalesce(new.load_id, old.load_id));
  return null;
end; $$;

drop trigger if exists trg_before_load_item_save on public.load_items;
create trigger trg_before_load_item_save before insert or update on public.load_items for each row execute function public.before_load_item_save();
drop trigger if exists trg_after_load_item_change on public.load_items;
create trigger trg_after_load_item_change after insert or update or delete on public.load_items for each row execute function public.after_load_item_change();

create or replace function public.before_load_insert()
returns trigger language plpgsql as $$
begin
  if new.codigo_interno is null or new.codigo_interno = '' then
    new.codigo_interno := public.generate_load_code(new.tipo);
  end if;
  new.updated_at := now();
  return new;
end; $$;

drop trigger if exists trg_before_load_insert on public.loads;
create trigger trg_before_load_insert before insert on public.loads for each row execute function public.before_load_insert();

alter table public.loads enable row level security;
alter table public.load_items enable row level security;
alter table public.load_checklists enable row level security;
alter table public.comments enable row level security;

create policy "loads_select" on public.loads for select using (auth.uid() is not null);
create policy "loads_insert" on public.loads for insert with check (public.current_user_role() in ('admin','gerente_estoque','gerente_ecommerce'));
create policy "loads_update" on public.loads for update using (public.current_user_role() in ('admin','gerente_estoque','gerente_ecommerce','operador_carga')) with check (public.current_user_role() in ('admin','gerente_estoque','gerente_ecommerce','operador_carga'));

create policy "load_items_select" on public.load_items for select using (auth.uid() is not null);
create policy "load_items_insert" on public.load_items for insert with check (public.current_user_role() in ('admin','gerente_estoque','gerente_ecommerce'));
create policy "load_items_update" on public.load_items for update using (public.current_user_role() in ('admin','gerente_estoque','gerente_ecommerce')) with check (public.current_user_role() in ('admin','gerente_estoque','gerente_ecommerce'));

create policy "load_checklists_select" on public.load_checklists for select using (auth.uid() is not null);
create policy "load_checklists_write" on public.load_checklists for all using (public.current_user_role() in ('admin','gerente_estoque','operador_carga')) with check (public.current_user_role() in ('admin','gerente_estoque','operador_carga'));

create policy "comments_select" on public.comments for select using (auth.uid() is not null);
create policy "comments_insert" on public.comments for insert with check (auth.uid() is not null);
