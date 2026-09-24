-- Busca de produto por SKU restrita à empresa da carga/solicitação.
-- p_company_id é opcional: sem ele, o comportamento é o de antes.

drop function if exists public.get_visible_product_by_sku(text);

create or replace function public.get_visible_product_by_sku(
  p_sku text,
  p_company_id uuid default null
)
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
    and (
      p_company_id is null
      or exists (
        select 1 from public.product_companies pc
        where pc.product_id = p.id and pc.company_id = p_company_id
      )
    )
  limit 1;
$$;

revoke all on function public.get_visible_product_by_sku(text, uuid) from public;
grant execute on function public.get_visible_product_by_sku(text, uuid) to authenticated;
