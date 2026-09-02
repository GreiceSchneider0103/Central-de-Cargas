-- Fix from the medium-priority list (2026-09-02): products search only
-- filtered the current 50-row page loaded in the browser. Add a search
-- parameter to get_visible_products_page so the search runs server-side,
-- over the whole visible catalog. (Audit log pagination is handled with
-- a plain range() query against the existing audit_logs_select RLS
-- policy — no new RPC needed there.)

drop function if exists public.get_visible_products_page(integer, integer);

create or replace function public.get_visible_products_page(
  p_page integer default 1,
  p_page_size integer default 50,
  p_search text default null
)
returns table (
  id uuid,
  sku text,
  nome text,
  cmv numeric,
  fornecedor_id uuid,
  ativo boolean,
  last_synced_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  supplier_name text,
  total_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select gp.*, count(*) over() as total_count
  from public.get_visible_products() gp
  where nullif(trim(p_search), '') is null
    or gp.sku ilike '%' || trim(p_search) || '%'
    or gp.nome ilike '%' || trim(p_search) || '%'
  limit greatest(1, least(coalesce(p_page_size, 50), 100))
  offset greatest(0, coalesce(p_page, 1) - 1) * greatest(1, least(coalesce(p_page_size, 50), 100));
$$;

revoke all on function public.get_visible_products_page(integer, integer, text) from public;
grant execute on function public.get_visible_products_page(integer, integer, text) to authenticated;
