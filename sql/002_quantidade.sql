alter table public.produtos
  add column quantidade integer not null default 1 check (quantidade >= 0);
grant insert (quantidade), update (quantidade) on public.produtos to authenticated;
