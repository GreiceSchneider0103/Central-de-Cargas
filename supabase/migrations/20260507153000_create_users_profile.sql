create extension if not exists pgcrypto;

create table if not exists public.users_profile (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  nome text,
  email text,
  perfil text not null check (perfil in ('admin','gerente_estoque','gerente_ecommerce','vendedor_loja','operador_carga','financeiro')),
  loja_id uuid null,
  empresa_id uuid null,
  ativo boolean not null default true,
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

drop trigger if exists trg_users_profile_updated_at on public.users_profile;
create trigger trg_users_profile_updated_at
before update on public.users_profile
for each row
execute function public.set_updated_at();

alter table public.users_profile enable row level security;

drop policy if exists "users can read own profile" on public.users_profile;
create policy "users can read own profile"
on public.users_profile
for select
using (auth.uid() = auth_user_id);

drop policy if exists "users can update own profile" on public.users_profile;
create policy "users can update own profile"
on public.users_profile
for update
using (auth.uid() = auth_user_id)
with check (auth.uid() = auth_user_id);
