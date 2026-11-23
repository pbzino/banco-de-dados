-- Teste no SQL Editor administrativo do projeto pessoal (uma conta).
-- Execute o bloco inteiro. ROLLBACK desfaz saldo e histórico.
begin;
select set_config('request.jwt.claim.sub', (select id::text from auth.users), true);
set local role authenticated;
select public.movimentar(id,'entrada',3,null,gen_random_uuid(),null)
from public.produtos where codigo='001';
select public.movimentar(id,'saida',2,null,gen_random_uuid(),null)
from public.produtos where codigo='001';
select public.movimentar(id,'ajuste',8,'Contagem física',gen_random_uuid(),quantidade)
from public.produtos where codigo='001';
select tipo,quantidade,saldo_anterior,saldo_final,motivo,criado_em
from public.movimentacoes order by criado_em desc;
rollback;
