alter table public.load_requests add column if not exists carga_id uuid references public.loads(id);

-- avoid duplicate conversion
create unique index if not exists uq_load_requests_carga_id_not_null on public.load_requests(carga_id) where carga_id is not null;

-- tighten delete: no delete policy for operational tables
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['load_requests','load_request_items','loads','load_items','load_checklists','comments','audit_logs']
  LOOP
    execute format('drop policy if exists %L on public.%I', t || '_delete', t);
  END LOOP;
END $$;

-- audit logs: allow insert only authenticated (server actions), select already restricted
alter table public.audit_logs enable row level security;
drop policy if exists "audit_logs_insert" on public.audit_logs;
create policy "audit_logs_insert" on public.audit_logs for insert with check (auth.uid() is not null);

-- conversion control: only admin/gerente_estoque can set transformed status and carga_id
create or replace function public.can_convert_request(req public.load_requests, new_status text)
returns boolean language sql stable as $$
  select case
    when new_status = 'Transformada em carga' then public.has_role(array['admin','gerente_estoque'])
    else true
  end;
$$;

drop policy if exists "load_requests_update" on public.load_requests;
create policy "load_requests_update" on public.load_requests for update using (public.can_update_load_request(load_requests)) with check (public.can_update_load_request(load_requests) and public.can_convert_request(load_requests, status));
