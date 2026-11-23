-- Execute depois de criar a tabela e a conta do estoque.
-- Com várias contas, substitua o SELECT em dono por SELECT 'seu-uuid'::uuid AS id.
-- Códigos que já existem são preservados.
with dono as (
  select id from auth.users where (select count(*) from auth.users) = 1
), catalogo as (
  select nome, ordem::integer - 1 as i
  from unnest(array[
    'Cabo HDMI', 'Cabo de rede', 'Cabo USB-C', 'Adaptador USB-C',
    'Mouse', 'Teclado', 'Pen drive', 'Leitor de cartão SD',
    'Carregador de celular', 'Fone de ouvido', 'Caneta azul', 'Lápis preto',
    'Borracha', 'Apontador', 'Grampeador', 'Caixa de grampos',
    'Tesoura', 'Fita adesiva', 'Bloco de notas', 'Régua de 30 cm'
  ]) with ordinality as lista(nome, ordem)
)
insert into public.produtos (proprietario, codigo, nome, localizacao, quantidade)
select dono.id, lpad((i + 1)::text, 3, '0'), nome,
       format('Prateleira %s · Linha %s · Coluna %s',
              1 + i / 10, 1 + (i % 10) / 2, 1 + i % 2),
       1
from dono cross join catalogo
on conflict (proprietario, upper(codigo)) do nothing
returning codigo, nome, localizacao, quantidade;
