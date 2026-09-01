-- P0 security/RBAC hardening: profiles, financial read masking and scoped operational access

-- 1) users_profile: remove self-write policies and allow sensitive profile management only to admins.
alter table public.users_profile enable row level security;

drop policy if exists "users can read own profile" on public.users_profile;
drop policy if exists "users can update own profile" on public.users_profile;
drop policy if exists "users_profile_select" on public.users_profile;
drop policy if exists "users_profile_insert" on public.users_profile;
drop policy if exists "users_profile_update" on public.users_profile;
drop policy if exists "users_profile_delete" on public.users_profile;
drop policy if exists "users_profile_admin_insert" on public.users_profile;
drop policy if exists "users_profile_admin_update" on public.users_profile;

create policy "users_profile_select"
on public.users_profile
for select
using (
  public.has_role(array['admin','gerente_estoque'])
  or auth_user_id = auth.uid()
);

create policy "users_profile_admin_insert"
on public.users_profile
for insert
with check (public.has_role(array['admin']));

create policy "users_profile_admin_update"
on public.users_profile
for update
using (public.has_role(array['admin']))
with check (public.has_role(array['admin']));

-- 2) Centralize load visibility so table policies, comments/checklists and safe RPCs share one rule.
create or replace function public.can_view_load(p_load public.loads)
returns boolean
language sql
stable
as $$
  select case
    when public.has_role(array['admin','gerente_estoque','operador_carga','financeiro']) then true
    when public.current_user_role() = 'gerente_ecommerce' then p_load.tipo = 'FULL_MARKETPLACE'
    when public.current_user_role() = 'vendedor_loja' then p_load.loja_destino_id in (
      select loja_id from public.users_profile where auth_user_id = auth.uid() and ativo = true
    )
    else false
  end;
$$;

-- 3) Prevent direct financial-column reads from browser clients. Financial data is exposed only through safe RPCs,
-- which null financial columns for roles without can_view_financial().
revoke select on public.loads from authenticated;
grant select (
  id,
  codigo_interno,
  numero_carga_marketplace,
  codigo_agendamento,
  tipo,
  empresa_id,
  canal_id,
  marketplace_id,
  destino_full_id,
  loja_destino_id,
  cd_origem_id,
  status,
  prioridade,
  data_agendada,
  data_prevista_recebimento,
  data_real_recebimento,
  tipo_coleta_id,
  transportador_id,
  solicitante_id,
  responsavel_operacional_id,
  observacoes,
  cancelada_em,
  cancelada_por,
  motivo_cancelamento,
  created_at,
  updated_at
) on public.loads to authenticated;

revoke select on public.load_items from authenticated;
grant select (
  id,
  load_id,
  product_id,
  sku,
  nome_produto,
  quantidade,
  fornecedor_origem_id,
  peso,
  altura,
  largura,
  profundidade,
  cubagem,
  data_prevista_recebimento,
  data_real_recebimento,
  status_item,
  observacao,
  created_at,
  updated_at
) on public.load_items to authenticated;

create or replace function public.get_visible_loads()
returns table (
  id uuid,
  codigo_interno text,
  numero_carga_marketplace text,
  codigo_agendamento text,
  tipo text,
  empresa_id uuid,
  canal_id uuid,
  marketplace_id uuid,
  destino_full_id uuid,
  loja_destino_id uuid,
  cd_origem_id uuid,
  status text,
  prioridade text,
  data_agendada timestamptz,
  data_prevista_recebimento timestamptz,
  data_real_recebimento timestamptz,
  tipo_coleta_id uuid,
  transportador_id uuid,
  custo_frete numeric,
  outros_custos numeric,
  faturamento_estimado numeric,
  cmv_total numeric,
  margem_estimativa_valor numeric,
  margem_estimativa_percentual numeric,
  solicitante_id uuid,
  responsavel_operacional_id uuid,
  observacoes text,
  cancelada_em timestamptz,
  cancelada_por uuid,
  motivo_cancelamento text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.id,
    l.codigo_interno,
    l.numero_carga_marketplace,
    l.codigo_agendamento,
    l.tipo,
    l.empresa_id,
    l.canal_id,
    l.marketplace_id,
    l.destino_full_id,
    l.loja_destino_id,
    l.cd_origem_id,
    l.status,
    l.prioridade,
    l.data_agendada,
    l.data_prevista_recebimento,
    l.data_real_recebimento,
    l.tipo_coleta_id,
    l.transportador_id,
    case when public.can_view_financial() then l.custo_frete else null end,
    case when public.can_view_financial() then l.outros_custos else null end,
    case when public.can_view_financial() then l.faturamento_estimado else null end,
    case when public.can_view_financial() then l.cmv_total else null end,
    case when public.can_view_financial() then l.margem_estimativa_valor else null end,
    case when public.can_view_financial() then l.margem_estimativa_percentual else null end,
    l.solicitante_id,
    l.responsavel_operacional_id,
    l.observacoes,
    l.cancelada_em,
    l.cancelada_por,
    l.motivo_cancelamento,
    l.created_at,
    l.updated_at
  from public.loads l
  where public.can_view_load(l)
  order by l.created_at desc;
$$;

revoke all on function public.get_visible_loads() from public;
grant execute on function public.get_visible_loads() to authenticated;

create or replace function public.get_visible_load_items(p_load_id uuid)
returns table (
  id uuid,
  load_id uuid,
  product_id uuid,
  sku text,
  nome_produto text,
  quantidade numeric,
  fornecedor_origem_id uuid,
  cmv_unitario numeric,
  cmv_total numeric,
  peso numeric,
  altura numeric,
  largura numeric,
  profundidade numeric,
  cubagem numeric,
  data_prevista_recebimento timestamptz,
  data_real_recebimento timestamptz,
  status_item text,
  observacao text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    li.id,
    li.load_id,
    li.product_id,
    li.sku,
    li.nome_produto,
    li.quantidade,
    li.fornecedor_origem_id,
    case when public.can_view_financial() then li.cmv_unitario else null end,
    case when public.can_view_financial() then li.cmv_total else null end,
    li.peso,
    li.altura,
    li.largura,
    li.profundidade,
    li.cubagem,
    li.data_prevista_recebimento,
    li.data_real_recebimento,
    li.status_item,
    li.observacao,
    li.created_at,
    li.updated_at
  from public.load_items li
  join public.loads l on l.id = li.load_id
  where li.load_id = p_load_id
    and public.can_view_load(l)
  order by li.created_at asc;
$$;

revoke all on function public.get_visible_load_items(uuid) from public;
grant execute on function public.get_visible_load_items(uuid) to authenticated;

-- 4) Operator cannot update arbitrary load columns. Operational status changes go through a narrow RPC.
drop policy if exists "loads_update" on public.loads;
create policy "loads_update" on public.loads
for update
using (public.can_manage_loads())
with check (public.can_manage_loads());

create or replace function public.set_load_operational_status_from_checklist(
  p_load_id uuid,
  p_status text
)
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

  if p_status not in ('Agendada','Carregada','Finalizada') then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;

  select * into v_load from public.loads where id = p_load_id for update;
  if v_load.id is null then
    raise exception 'LOAD_NOT_FOUND' using errcode = 'P0001';
  end if;

  update public.loads
  set status = p_status,
      updated_at = now()
  where id = p_load_id;
end;
$$;

revoke all on function public.set_load_operational_status_from_checklist(uuid, text) from public;
grant execute on function public.set_load_operational_status_from_checklist(uuid, text) to authenticated;

-- 5) Restrict comments/checklists reads to users allowed to see their related load/request.
drop policy if exists "load_checklists_select" on public.load_checklists;
create policy "load_checklists_select" on public.load_checklists
for select
using (
  exists (
    select 1
    from public.loads l
    where l.id = load_id
      and public.can_view_load(l)
  )
);

drop policy if exists "comments_select" on public.comments;
create policy "comments_select" on public.comments
for select
using (
  (
    entidade = 'load'
    and exists (
      select 1 from public.loads l
      where l.id = entidade_id
        and public.can_view_load(l)
    )
  )
  or
  (
    entidade in ('load_request','request','solicitacao')
    and exists (
      select 1 from public.load_requests lr
      where lr.id = entidade_id
        and public.can_view_load_request(lr)
    )
  )
);

-- 6) Products CMV is financial information; expose it only through masked RPCs.
revoke select on public.products from authenticated;
grant select (
  id,
  sku,
  nome,
  fornecedor_id,
  ativo,
  last_synced_at,
  created_at,
  updated_at
) on public.products to authenticated;

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
  updated_at timestamptz
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
    p.updated_at
  from public.products p
  where auth.uid() is not null
  order by p.nome asc;
$$;

revoke all on function public.get_visible_products() from public;
grant execute on function public.get_visible_products() to authenticated;

create or replace function public.get_visible_product_by_sku(p_sku text)
returns table (
  id uuid,
  nome text,
  cmv numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.nome,
    case when public.can_view_financial() then p.cmv else null end
  from public.products p
  where auth.uid() is not null
    and p.sku = p_sku
  limit 1;
$$;

revoke all on function public.get_visible_product_by_sku(text) from public;
grant execute on function public.get_visible_product_by_sku(text) to authenticated;
