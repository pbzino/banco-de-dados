-- Consultas para o SQL Editor administrativo do estoque pessoal.
-- Selecione a consulta desejada e clique em Run.

-- Inventário completo
select codigo, nome, localizacao, quantidade
from public.produtos order by codigo;

-- Localizar um produto pelo código, preservando os zeros à esquerda
select nome, localizacao, quantidade
from public.produtos where codigo = '001';

-- Buscar por parte do nome
select codigo, nome, quantidade
from public.produtos where nome ilike '%cabo%' order by codigo;

-- Listar os produtos da primeira prateleira
select localizacao, codigo, nome, quantidade
from public.produtos where localizacao like 'Prateleira 1 · %'
order by localizacao, codigo;

-- Contar tipos de produto e somar as unidades físicas
select count(*) as produtos_cadastrados, coalesce(sum(quantidade), 0) as unidades
from public.produtos;

-- Encontrar produtos esgotados
select codigo, nome, localizacao
from public.produtos where quantidade = 0 order by codigo;
