create or replace function public.can_view_load_request(req public.load_requests)
returns boolean
language sql
stable
as $$
  select case
    when public.current_user_role() in ('admin','gerente_estoque','operador_carga','financeiro') then true
    when public.current_user_role() = 'gerente_ecommerce' then req.tipo = 'FULL_MARKETPLACE' or req.solicitante_id in (select id from public.users_profile where auth_user_id = auth.uid())
    when public.current_user_role() = 'vendedor_loja' then req.solicitante_id in (select id from public.users_profile where auth_user_id = auth.uid()) or req.loja_destino_id in (select loja_id from public.users_profile where auth_user_id = auth.uid())
    else false
  end;
$$;

create or replace function public.can_create_load_request(tipo text)
returns boolean
language sql
stable
as $$
  select case
    when public.current_user_role() in ('admin','gerente_estoque') then true
    when public.current_user_role() = 'gerente_ecommerce' then tipo = 'FULL_MARKETPLACE'
    when public.current_user_role() = 'vendedor_loja' then tipo = 'LOJA_FISICA'
    else false
  end;
$$;

create or replace function public.can_update_load_request(req public.load_requests)
returns boolean
language sql
stable
as $$
  select case
    when public.current_user_role() in ('admin','gerente_estoque') then true
    when req.solicitante_id in (select id from public.users_profile where auth_user_id = auth.uid()) and req.status in ('Pendente','Ajuste solicitado') then true
    else false
  end;
$$;

drop policy if exists "load_requests_select" on public.load_requests;
drop policy if exists "load_requests_insert" on public.load_requests;
drop policy if exists "load_requests_update" on public.load_requests;

create policy "load_requests_select" on public.load_requests for select using (public.can_view_load_request(load_requests));
create policy "load_requests_insert" on public.load_requests for insert with check (public.can_create_load_request(tipo));
create policy "load_requests_update" on public.load_requests for update using (public.can_update_load_request(load_requests)) with check (public.can_update_load_request(load_requests));

-- itens: quem vê request vê itens; quem pode atualizar request pode alterar itens
DROP POLICY IF EXISTS "load_request_items_select" ON public.load_request_items;
DROP POLICY IF EXISTS "load_request_items_insert" ON public.load_request_items;
DROP POLICY IF EXISTS "load_request_items_update" ON public.load_request_items;

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
