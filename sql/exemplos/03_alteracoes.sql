-- No SQL Editor, selecione um bloco inteiro de BEGIN até ROLLBACK e execute.
-- ROLLBACK desfaz o teste. Para gravar, troque ROLLBACK por COMMIT antes de executar.
-- Os exemplos selecionam o dono quando existe uma única conta.
-- Com várias contas, substitua a subconsulta de proprietário pelo UUID desejado.

-- Definir o saldo após uma contagem física
begin;
update public.produtos set quantidade = 8
where codigo = '001' and proprietario = (select id from auth.users)
returning codigo, nome, quantidade;
rollback;

-- Receber três unidades
begin;
update public.produtos set quantidade = quantidade + 3
where codigo = '001' and proprietario = (select id from auth.users)
returning codigo, nome, quantidade;
rollback;

-- Retirar duas unidades apenas se houver saldo suficiente
begin;
update public.produtos set quantidade = quantidade - 2
where codigo = '001' and proprietario = (select id from auth.users)
  and quantidade >= 2
returning codigo, nome, quantidade;
rollback;

-- Transferir o item para a terceira coluna
begin;
update public.produtos set localizacao = 'Prateleira 1 · Linha 1 · Coluna 3'
where codigo = '001' and proprietario = (select id from auth.users)
returning codigo, nome, localizacao;
rollback;
