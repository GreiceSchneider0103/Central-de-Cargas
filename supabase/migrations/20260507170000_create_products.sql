create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  sku text unique not null,
  nome text not null,
  cmv numeric not null default 0,
  fornecedor_id uuid null references public.suppliers(id),
  ativo boolean not null default true,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
before update on public.products
for each row execute function public.set_updated_at();

alter table public.products enable row level security;

drop policy if exists "products_select" on public.products;
drop policy if exists "products_insert" on public.products;
drop policy if exists "products_update" on public.products;

create policy "products_select"
on public.products
for select
using (auth.uid() is not null);

create policy "products_insert"
on public.products
for insert
with check (public.current_user_role() in ('admin', 'gerente_estoque'));

create policy "products_update"
on public.products
for update
using (public.current_user_role() in ('admin', 'gerente_estoque'))
with check (public.current_user_role() in ('admin', 'gerente_estoque'));
