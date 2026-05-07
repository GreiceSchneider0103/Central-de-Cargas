create extension if not exists pgcrypto;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cnpj text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.distribution_centers (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cnpj text,
  telefone text,
  contato_nome text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.full_destinations (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  marketplace_id uuid references public.channels(id),
  endereco text,
  codigo_agendamento_padrao text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transport_types (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- triggers updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
as $$
  select perfil from public.users_profile where auth_user_id = auth.uid() and ativo = true limit 1;
$$;

create or replace function public.can_manage_registries()
returns boolean
language sql
stable
as $$
  select public.current_user_role() in ('admin', 'gerente_estoque');
$$;

-- enable rls + policies
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['companies','distribution_centers','stores','suppliers','channels','full_destinations','transport_types']
  LOOP
    EXECUTE format('alter table public.%I enable row level security', tbl);
    EXECUTE format('drop policy if exists "%s_select" on public.%I', tbl, tbl);
    EXECUTE format('drop policy if exists "%s_insert" on public.%I', tbl, tbl);
    EXECUTE format('drop policy if exists "%s_update" on public.%I', tbl, tbl);

    EXECUTE format('create policy "%s_select" on public.%I for select using (auth.uid() is not null)', tbl, tbl);
    EXECUTE format('create policy "%s_insert" on public.%I for insert with check (public.can_manage_registries())', tbl, tbl);
    EXECUTE format('create policy "%s_update" on public.%I for update using (public.can_manage_registries()) with check (public.can_manage_registries())', tbl, tbl);
  END LOOP;
END $$;

-- seed
insert into public.companies (nome) values
('Lessul Matriz'),('Lessul SC'),('Lessul SP'),('MS Decor'),('Crielus'),('Crielus SC'),('Movelbento'),('Viva Vida'),('Modifika')
on conflict do nothing;

insert into public.distribution_centers (nome) values
('Matriz'),('João Bayer')
on conflict do nothing;

insert into public.stores (nome) values
('Matriz'),('Sebastião'),('Tramandaí'),('Sapiranga')
on conflict do nothing;

insert into public.channels (nome,tipo) values
('Mercado Livre','Marketplace Full'),('Magalu','Marketplace Full'),('Amazon','Marketplace Full'),('Loja física','Loja física'),('Transferência interna','Transferência interna')
on conflict do nothing;

insert into public.suppliers (nome) values
('IRM'),('Tradição'),('MS Decor'),('Movelbento'),('Ortobom'),('Herval')
on conflict do nothing;

insert into public.transport_types (nome,tipo) values
('Tradição','Transportadora'),('Coleta','Coleta'),('Privado/Mateus','Privado'),('Brunetto PV','Privado'),('Addison PV','Privado'),('Expresso São Miguel','Transportadora'),('Cristofoli','Transportadora'),('Tiago PV','Privado')
on conflict do nothing;
