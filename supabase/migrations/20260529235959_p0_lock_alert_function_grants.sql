-- P0 security hardening: prevent direct execution of internal alert upsert helper.
-- The `public.upsert_load_alert(...)` helper is meant to be used only by SECURITY DEFINER routines
-- (e.g. `evaluate_load_alerts`) and triggers, not by end-user clients.

do $$
begin
  -- Revoke default/public execute to avoid any direct calls by browser clients.
  revoke all on function public.upsert_load_alert(uuid, text, text, boolean) from public;
  revoke execute on function public.upsert_load_alert(uuid, text, text, boolean) from anon;
  revoke execute on function public.upsert_load_alert(uuid, text, text, boolean) from authenticated;

  -- Allow backend/service operations if needed (Supabase service role).
  -- (Triggers and SECURITY DEFINER functions owned by a privileged role will still work regardless.)
  grant execute on function public.upsert_load_alert(uuid, text, text, boolean) to service_role;
exception
  when undefined_function then
    -- Function might not exist yet in some environments; keep migration idempotent.
    null;
  when undefined_object then
    -- Roles like anon/authenticated/service_role might not exist in non-Supabase Postgres.
    null;
end $$;

-- Defense in depth: ensure clients cannot write to load_alerts directly (RLS already blocks).
do $$
begin
  revoke insert, update, delete on table public.load_alerts from anon;
  revoke insert, update, delete on table public.load_alerts from authenticated;
exception
  when undefined_table then null;
  when undefined_object then null;
end $$;

