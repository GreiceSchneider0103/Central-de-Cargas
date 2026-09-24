alter table public.companies add constraint companies_nome_key unique (nome);
alter table public.distribution_centers add constraint distribution_centers_nome_key unique (nome);
alter table public.stores add constraint stores_nome_key unique (nome);
alter table public.suppliers add constraint suppliers_nome_key unique (nome);
alter table public.channels add constraint channels_nome_key unique (nome);
alter table public.transport_types add constraint transport_types_nome_key unique (nome);
