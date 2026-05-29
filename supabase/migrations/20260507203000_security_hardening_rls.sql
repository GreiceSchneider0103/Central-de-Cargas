-- Security hardening: central RBAC helpers, RLS normalization and audit logs

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  tabela text not null,
  registro_id uuid,
  acao text not null,
  payload jsonb,
  profile_id uuid references public.users_profile(id),
  created_at timestamptz not null default now()
);

create or replace function public.current_profile_id()
returns uuid
language sql
stable
as $$
  select id from public.users_profile where auth_user_id = auth.uid() and ativo = true limit 1;
$$;

create or replace function public.has_role(roles text[])
returns boolean
language sql
stable
as $$
  select public.current_user_role() = any(roles);
$$;

create or replace function public.is_authenticated()
returns boolean
language sql
stable
as $$
  select auth.uid() is not null;
$$;

create or replace function public.can_manage_registry()
returns boolean
language sql
stable
as $$
  select public.has_role(array['admin','gerente_estoque']);
$$;

create or replace function public.can_view_financial()
returns boolean
language sql
stable
as $$
  select public.has_role(array['admin','gerente_estoque','financeiro','gerente_ecommerce']);
$$;

create or replace function public.can_manage_loads()
returns boolean
language sql
stable
as $$
  select public.has_role(array['admin','gerente_estoque','gerente_ecommerce']);
$$;

create or replace function public.can_operate_checklist()
returns boolean
language sql
stable
as $$
  select public.has_role(array['admin','gerente_estoque','operador_carga']);
$$;

-- audit trigger
create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs(tabela, registro_id, acao, payload, profile_id)
  values (
    tg_table_name,
    coalesce(new.id, old.id),
    tg_op,
    case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end,
    public.current_profile_id()
  );
  return coalesce(new, old);
end;
$$;

-- Attach audit trigger on critical tables (idempotent)
do $$
declare t text;
begin
  foreach t in array array['products','load_requests','load_request_items','loads','load_items','load_checklists','companies','distribution_centers','stores','suppliers','channels','full_destinations','transport_types']
  loop
    execute format('drop trigger if exists trg_audit_%I on public.%I', t, t);
    execute format('create trigger trg_audit_%I after insert or update or delete on public.%I for each row execute function public.write_audit_log()', t, t);
  end loop;
end $$;

-- RLS normalization
-- users_profile
alter table public.users_profile enable row level security;
drop policy if exists "users_profile_select" on public.users_profile;
drop policy if exists "users_profile_insert" on public.users_profile;
drop policy if exists "users_profile_update" on public.users_profile;
create policy "users_profile_select" on public.users_profile for select using (
  public.has_role(array['admin','gerente_estoque']) or auth_user_id = auth.uid()
);
create policy "users_profile_insert" on public.users_profile for insert with check (
  public.has_role(array['admin']) or auth_user_id = auth.uid()
);
create policy "users_profile_update" on public.users_profile for update using (
  public.has_role(array['admin']) or auth_user_id = auth.uid()
) with check (
  public.has_role(array['admin']) or auth_user_id = auth.uid()
);

-- registry tables
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['companies','distribution_centers','stores','suppliers','channels','full_destinations','transport_types']
  LOOP
    EXECUTE format('alter table public.%I enable row level security', t);
    EXECUTE format('drop policy if exists %L on public.%I', t || '_select', t);
    EXECUTE format('drop policy if exists %L on public.%I', t || '_write', t);
    EXECUTE format('create policy %I on public.%I for select using (public.is_authenticated())', t || '_select', t);
    EXECUTE format('create policy %I on public.%I for all using (public.can_manage_registry()) with check (public.can_manage_registry())', t || '_write', t);
  END LOOP;
END $$;

-- products
alter table public.products enable row level security;
drop policy if exists "products_select" on public.products;
drop policy if exists "products_write" on public.products;
create policy "products_select" on public.products for select using (public.is_authenticated());
create policy "products_write" on public.products for all using (public.can_manage_registry()) with check (public.can_manage_registry());

-- load requests
alter table public.load_requests enable row level security;
drop policy if exists "load_requests_select" on public.load_requests;
drop policy if exists "load_requests_insert" on public.load_requests;
drop policy if exists "load_requests_update" on public.load_requests;
create policy "load_requests_select" on public.load_requests for select using (public.can_view_load_request(load_requests));
create policy "load_requests_insert" on public.load_requests for insert with check (public.can_create_load_request(tipo));
create policy "load_requests_update" on public.load_requests for update using (public.can_update_load_request(load_requests)) with check (public.can_update_load_request(load_requests));

-- load_request_items
alter table public.load_request_items enable row level security;
drop policy if exists "load_request_items_select" on public.load_request_items;
drop policy if exists "load_request_items_insert" on public.load_request_items;
drop policy if exists "load_request_items_update" on public.load_request_items;
create policy "load_request_items_select" on public.load_request_items for select using (
  exists(select 1 from public.load_requests lr where lr.id = request_id and public.can_view_load_request(lr))
);
create policy "load_request_items_insert" on public.load_request_items for insert with check (
  exists(select 1 from public.load_requests lr where lr.id = request_id and public.can_update_load_request(lr))
);
create policy "load_request_items_update" on public.load_request_items for update using (
  exists(select 1 from public.load_requests lr where lr.id = request_id and public.can_update_load_request(lr))
) with check (
  exists(select 1 from public.load_requests lr where lr.id = request_id and public.can_update_load_request(lr))
);

-- loads / items / checklists / comments / audit_logs
alter table public.loads enable row level security;
alter table public.load_items enable row level security;
alter table public.load_checklists enable row level security;
alter table public.comments enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "loads_select" on public.loads;
drop policy if exists "loads_insert" on public.loads;
drop policy if exists "loads_update" on public.loads;
create policy "loads_select" on public.loads for select using (
  public.has_role(array['admin','gerente_estoque','operador_carga','financeiro'])
  or (public.current_user_role() = 'gerente_ecommerce' and tipo = 'FULL_MARKETPLACE')
  or (public.current_user_role() = 'vendedor_loja' and loja_destino_id in (select loja_id from public.users_profile where auth_user_id = auth.uid()))
);
create policy "loads_insert" on public.loads for insert with check (public.can_manage_loads());
create policy "loads_update" on public.loads for update using (public.can_manage_loads() or public.can_operate_checklist()) with check (public.can_manage_loads() or public.can_operate_checklist());

drop policy if exists "load_items_select" on public.load_items;
drop policy if exists "load_items_write" on public.load_items;
create policy "load_items_select" on public.load_items for select using (
  exists(select 1 from public.loads l where l.id = load_id and (
    public.has_role(array['admin','gerente_estoque','operador_carga','financeiro'])
    or (public.current_user_role() = 'gerente_ecommerce' and l.tipo = 'FULL_MARKETPLACE')
    or (public.current_user_role() = 'vendedor_loja' and l.loja_destino_id in (select loja_id from public.users_profile where auth_user_id = auth.uid()))
  ))
);
create policy "load_items_write" on public.load_items for all using (public.can_manage_loads()) with check (public.can_manage_loads());

drop policy if exists "load_checklists_select" on public.load_checklists;
drop policy if exists "load_checklists_write" on public.load_checklists;
create policy "load_checklists_select" on public.load_checklists for select using (public.is_authenticated());
create policy "load_checklists_write" on public.load_checklists for all using (public.can_operate_checklist()) with check (public.can_operate_checklist());

drop policy if exists "comments_select" on public.comments;
drop policy if exists "comments_insert" on public.comments;
create policy "comments_select" on public.comments for select using (public.is_authenticated());
create policy "comments_insert" on public.comments for insert with check (public.is_authenticated());

drop policy if exists "audit_logs_select" on public.audit_logs;
create policy "audit_logs_select" on public.audit_logs for select using (public.has_role(array['admin','gerente_estoque','financeiro']));
