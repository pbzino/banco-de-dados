create table public.movimentacoes (
  id uuid primary key,
  produto_id uuid not null references public.produtos(id) on delete cascade,
  responsavel uuid not null references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('entrada','saida','ajuste')),
  quantidade integer not null check (quantidade >= 0),
  saldo_anterior integer not null check (saldo_anterior >= 0),
  saldo_final integer not null check (saldo_final >= 0),
  motivo text,
  criado_em timestamptz not null default clock_timestamp()
);
create index movimentacoes_historico on public.movimentacoes(responsavel,produto_id,criado_em desc);
alter table public.movimentacoes enable row level security;
revoke all on public.movimentacoes from public, anon, authenticated;
grant select on public.movimentacoes to authenticated;
create policy ver_historico on public.movimentacoes for select to authenticated
using (responsavel = (select auth.uid()));

-- A conta pode editar o cadastro. As mudanças de saldo passam pela função.
revoke update (quantidade) on public.produtos from authenticated;

create function public.movimentar(p_produto uuid, p_tipo text, p_quantidade integer,
  p_motivo text, p_solicitacao uuid, p_saldo_esperado integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  ator uuid := auth.uid();
  anterior integer;
  novo integer;
  repetida public.movimentacoes%rowtype;
  motivo_limpo text := nullif(btrim(p_motivo),'');
begin
  select quantidade into anterior from public.produtos
    where id=p_produto and proprietario=ator for update;
  if not found then raise exception 'Produto indisponível.'; end if;
  select * into repetida from public.movimentacoes where id=p_solicitacao;
  if found then
    if repetida.responsavel=ator and repetida.produto_id=p_produto
      and repetida.tipo=p_tipo and repetida.quantidade=p_quantidade
      and repetida.motivo is not distinct from motivo_limpo then return repetida.saldo_final; end if;
    raise exception 'Solicitação inválida.';
  end if;
  if p_quantidade is null or p_quantidade < 0 or p_tipo is null or
    p_tipo not in ('entrada','saida','ajuste') or (p_tipo <> 'ajuste' and p_quantidade=0)
    then raise exception 'Quantidade inválida.'; end if;
  if p_tipo='ajuste' then
    if motivo_limpo is null then raise exception 'Informe o motivo do ajuste.'; end if;
    if anterior is distinct from p_saldo_esperado then raise exception 'Saldo alterado. Reabra a movimentação.'; end if;
  end if;
  novo := case p_tipo when 'entrada' then anterior+p_quantidade when 'saida' then anterior-p_quantidade else p_quantidade end;
  if novo<0 then raise exception 'Saldo insuficiente.'; end if;
  update public.produtos set quantidade=novo where id=p_produto;
  insert into public.movimentacoes(id,produto_id,responsavel,tipo,quantidade,saldo_anterior,saldo_final,motivo)
    values(p_solicitacao,p_produto,ator,p_tipo,p_quantidade,anterior,novo,motivo_limpo);
  return novo;
end $$;
revoke all on function public.movimentar(uuid,text,integer,text,uuid,integer) from public, anon;
grant execute on function public.movimentar(uuid,text,integer,text,uuid,integer) to authenticated;
