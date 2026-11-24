create function public.editar_produto(p_id uuid, p_original jsonb, p_codigo text, p_nome text, p_localizacao text, p_quantidade integer, p_motivo text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare atual public.produtos%rowtype;
begin
  select * into strict atual from public.produtos where id=p_id and proprietario=auth.uid() for update;
  if (atual.codigo, atual.nome, atual.localizacao) is distinct from
     (p_original->>'codigo', p_original->>'nome', p_original->>'localizacao') then
    raise exception 'Cadastro alterado por outra sessão. Atualize e abra Editar novamente.';
  end if;
  update public.produtos set codigo=btrim(p_codigo),nome=btrim(p_nome),localizacao=btrim(p_localizacao) where id=p_id;
  if p_quantidade is distinct from (p_original->>'quantidade')::integer then
    perform public.movimentar(p_id,'ajuste',p_quantidade,p_motivo,gen_random_uuid(),(p_original->>'quantidade')::integer);
  end if;
  return p_id;
end $$;
revoke all on function public.editar_produto(uuid,jsonb,text,text,text,integer,text) from public,anon;
grant execute on function public.editar_produto(uuid,jsonb,text,text,text,integer,text) to authenticated;
create policy excluir_meu_produto on public.produtos for delete to authenticated using (proprietario=(select auth.uid()));
grant delete on public.produtos to authenticated;
