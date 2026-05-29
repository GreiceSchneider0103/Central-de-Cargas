-- P1 alerts: keep alerts up-to-date automatically on relevant changes.

create or replace function public.trg_evaluate_load_alerts_from_load()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.evaluate_load_alerts(coalesce(new.id, old.id));
  return coalesce(new, old);
end;
$$;

create or replace function public.trg_evaluate_load_alerts_from_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.evaluate_load_alerts(coalesce(new.load_id, old.load_id));
  return coalesce(new, old);
end;
$$;

create or replace function public.trg_evaluate_load_alerts_from_checklist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.evaluate_load_alerts(coalesce(new.load_id, old.load_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_loads_eval_alerts on public.loads;
create trigger trg_loads_eval_alerts
after insert or update of tipo, status, numero_carga_marketplace, codigo_agendamento, data_agendada, data_prevista_recebimento, faturamento_estimado
on public.loads
for each row execute function public.trg_evaluate_load_alerts_from_load();

drop trigger if exists trg_load_items_eval_alerts on public.load_items;
create trigger trg_load_items_eval_alerts
after insert or update or delete
on public.load_items
for each row execute function public.trg_evaluate_load_alerts_from_item();

drop trigger if exists trg_load_checklists_eval_alerts on public.load_checklists;
create trigger trg_load_checklists_eval_alerts
after insert or update of nf_emitida, finalizada
on public.load_checklists
for each row execute function public.trg_evaluate_load_alerts_from_checklist();

