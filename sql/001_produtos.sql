begin;

create table public.produtos (
  id uuid primary key default gen_random_uuid(),
  proprietario uuid not null default auth.uid() references auth.users(id) on delete cascade,
  codigo text not null check (codigo = btrim(codigo) and length(codigo) between 1 and 64),
  nome text not null check (length(btrim(nome)) between 1 and 160),
  localizacao text not null check (length(btrim(localizacao)) between 1 and 160)
);
create unique index produtos_codigo_por_usuario
  on public.produtos (proprietario, upper(codigo));
alter table public.produtos enable row level security;

revoke all on public.produtos from public, anon, authenticated;
grant select on public.produtos to authenticated;
grant insert (codigo, nome, localizacao), update (codigo, nome, localizacao)
  on public.produtos to authenticated;

create policy consultar_meus_produtos on public.produtos
  for select to authenticated using (proprietario = (select auth.uid()));
create policy cadastrar_meus_produtos on public.produtos
  for insert to authenticated with check (proprietario = (select auth.uid()));
create policy editar_meus_produtos on public.produtos
  for update to authenticated using (proprietario = (select auth.uid()))
  with check (proprietario = (select auth.uid()));

commit;
