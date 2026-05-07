create table if not exists public.load_requests (
  id uuid primary key default gen_random_uuid(),
  codigo text unique,
  tipo text not null,
  empresa_id uuid references public.companies(id),
  canal_id uuid references public.channels(id),
  marketplace_id uuid null references public.channels(id),
  destino_full_id uuid null references public.full_destinations(id),
  loja_destino_id uuid null references public.stores(id),
  prioridade text,
  data_desejada timestamptz,
  status text not null default 'Pendente',
  solicitante_id uuid references public.users_profile(id),
  observacoes text,
  motivo_recusa text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_status_load_request check (status in ('Pendente','Em análise','Aprovada','Recusada','Ajuste solicitado','Transformada em carga','Cancelada'))
);

create table if not exists public.load_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.load_requests(id) on delete cascade,
  product_id uuid null references public.products(id),
  sku text not null,
  nome_produto text not null,
  quantidade numeric not null,
  fornecedor_origem_id uuid null references public.suppliers(id),
  cmv_unitario numeric not null default 0,
  cmv_total numeric not null default 0,
  data_prevista_recebimento timestamptz null,
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.load_request_history (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.load_requests(id) on delete cascade,
  acao text not null,
  status_anterior text,
  status_novo text,
  observacao text,
  autor_profile_id uuid references public.users_profile(id),
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_load_requests_updated_at on public.load_requests;
create trigger trg_load_requests_updated_at before update on public.load_requests for each row execute function public.set_updated_at();
drop trigger if exists trg_load_request_items_updated_at on public.load_request_items;
create trigger trg_load_request_items_updated_at before update on public.load_request_items for each row execute function public.set_updated_at();

create or replace function public.can_approve_requests()
returns boolean language sql stable as $$ select public.current_user_role() in ('admin','gerente_estoque'); $$;

alter table public.load_requests enable row level security;
alter table public.load_request_items enable row level security;
alter table public.load_request_history enable row level security;

create policy "load_requests_select" on public.load_requests for select using (auth.uid() is not null);
create policy "load_requests_insert" on public.load_requests for insert with check (auth.uid() is not null);
create policy "load_requests_update" on public.load_requests for update using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "load_request_items_select" on public.load_request_items for select using (auth.uid() is not null);
create policy "load_request_items_insert" on public.load_request_items for insert with check (auth.uid() is not null);
create policy "load_request_items_update" on public.load_request_items for update using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "load_request_history_select" on public.load_request_history for select using (auth.uid() is not null);
create policy "load_request_history_insert" on public.load_request_history for insert with check (auth.uid() is not null);
