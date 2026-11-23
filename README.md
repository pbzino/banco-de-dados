# Almox

Cadastro de produtos com código, nome, localização e quantidade. O estoque aceita códigos com zeros à esquerda e permite buscar e editar produtos. Cada conta consulta e altera seus próprios registros.

## Projeto configurado

A interface já aponta para o projeto almox em São Paulo. Para usar este banco, cadastre sua conta de acesso em Authentication → Users → Add user no painel do projeto e execute a interface conforme as instruções abaixo.

## Recriar o banco em outro projeto

1. Crie um projeto gratuito no Supabase. No SQL Editor do projeto novo, execute uma vez os scripts `sql/001_produtos.sql` e `sql/002_quantidade.sql`, nesta ordem.
2. Em Authentication, crie seu usuário com e-mail e senha e confirme o e-mail. Para um estoque pessoal, desative a opção que permite novos cadastros nas configurações de autenticação.
3. No painel do projeto, copie a Project URL e a chave **publishable** para `docs/config.js`. A chave publicável identifica o projeto no navegador. A senha do banco, a senha do usuário e a chave secreta devem ficar fora do repositório.

A tabela `public.produtos` usa UUID como chave primária. O código é texto e possui índice único por proprietário, sem distinção entre maiúsculas e minúsculas. As políticas de segurança por linha usam o ID da conta autenticada para controlar cada operação.

Para ajustar o saldo, clique em **Editar**, altere **Quantidade** para o total atual e clique em **Salvar alterações**. Use zero quando o produto acabar.

## Executar no computador

Na pasta do projeto, execute `python -m http.server 8000 --directory docs`. Abra http://localhost:8000 e entre com a conta criada no Supabase. É necessária conexão com a internet para carregar o cliente e acessar o banco.

## Publicar no GitHub

Extraia o projeto e envie o conteúdo da pasta almox a um repositório, preservando as pastas docs e sql. Para hospedar a interface em um repositório público, abra Settings → Pages, selecione Deploy from a branch, a branch principal e a pasta /docs. Abra o endereço informado pelo Pages após a publicação. O código e o esquema SQL ficam no GitHub. Os registros de estoque ficam no Supabase.

## Consulta SQL

No SQL Editor administrativo, a consulta abaixo lista os produtos cadastrados, em ordem de nome. No site, a mesma tabela aplica as permissões da conta conectada.

```sql
select codigo, nome, localizacao, quantidade
from public.produtos
order by nome, codigo;
```
