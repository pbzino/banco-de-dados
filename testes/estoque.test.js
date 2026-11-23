import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const dono = "00000000-0000-4000-8000-000000000001";
const visitante = "00000000-0000-4000-8000-000000000002";
const sql = (arquivo) =>
  readFile(new URL("../sql/" + arquivo, import.meta.url), "utf8");

before(async () => {
  // O servidor de autenticação do Supabase injeta o identificador do usuário.
  // Aqui reproduzimos esse contrato mínimo em um PostgreSQL local descartável.
  await db.exec(`
    create schema auth;
    create role anon;
    create role authenticated;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select current_setting('app.uid', true)::uuid $$;
    grant usage on schema auth to authenticated;
  `);
  await db.query("insert into auth.users values ($1)", [dono]);
  for (const arquivo of [
    "001_produtos.sql",
    "002_quantidade.sql",
    "003_movimentacoes.sql",
    "exemplos/01_cadastrar_20_produtos.sql",
  ]) {
    await db.exec(await sql(arquivo));
  }
});
after(() => db.close());

async function comUsuario(id, executar) {
  await db.transaction(async (tx) => {
    await tx.exec("set local role authenticated");
    await tx.query("select set_config('app.uid', $1, true)", [id]);
    await executar(tx);
  });
}

test("a carga pode ser repetida e ocupa 20 posições diferentes", async () => {
  await db.exec(await sql("exemplos/01_cadastrar_20_produtos.sql"));
  const { rows } = await db.query(
    "select count(*)::int as itens, count(distinct localizacao)::int as posicoes, min(codigo) as primeiro from public.produtos",
  );
  assert.deepEqual(rows[0], { itens: 20, posicoes: 20, primeiro: "001" });
});

test("baixa, histórico e repetição da mesma solicitação são atômicos", async () => {
  await comUsuario(dono, async (tx) => {
    const {
      rows: [item],
    } = await tx.query("select id from produtos where codigo='001'");
    const baixar = () =>
      tx.query("select movimentar($1,'saida',1,null,$2,null) as saldo", [
        item.id,
        pedido,
      ]);
    const pedido = crypto.randomUUID();
    assert.equal((await baixar()).rows[0].saldo, 0);
    assert.equal((await baixar()).rows[0].saldo, 0);
    assert.equal(
      (await tx.query("select saldo_anterior,saldo_final from movimentacoes"))
        .rows.length,
      1,
    );
  });
  const mover = (tipo, qtd, motivo, esperado) =>
    comUsuario(dono, (tx) =>
      tx.query(
        "select movimentar(id,$1,$2,$3,gen_random_uuid(),$4) from produtos where codigo='001'",
        [tipo, qtd, motivo, esperado],
      ),
    );
  await assert.rejects(mover("saida", 1, null, null), /Saldo insuficiente/);
  await assert.rejects(mover("ajuste", 5, " ", 0), /motivo/);
  await assert.rejects(mover("ajuste", 5, "Contagem", 1), /Saldo alterado/);
  await mover("entrada", 3, null, null);
  await mover("ajuste", 2, "Contagem", 3);
  await assert.rejects(
    comUsuario(dono, (tx) => tx.exec("update produtos set quantidade=12")),
    { code: "42501" },
  );
  const { rows } = await db.query(
    "select tipo,saldo_final from movimentacoes order by criado_em",
  );
  assert.deepEqual(
    rows.map((r) => [r.tipo, r.saldo_final]),
    [
      ["saida", 0],
      ["entrada", 3],
      ["ajuste", 2],
    ],
  );
});

test("uma conta só lê e altera os próprios itens", async () => {
  await db.query("insert into auth.users values ($1)", [visitante]);
  await comUsuario(visitante, async (tx) => {
    assert.equal((await tx.query("select id from produtos")).rows.length, 0);
    assert.equal(
      (await tx.query("update produtos set nome = 'Outro' returning id")).rows
        .length,
      0,
    );
    await tx.exec(
      "insert into produtos(codigo,nome,localizacao) values ('001','Papel','Gaveta')",
    );
  });
});

test("códigos que diferem apenas em maiúsculas são duplicados por conta", async () => {
  await comUsuario(dono, (tx) =>
    tx.exec(
      "insert into produtos(codigo,nome,localizacao) values ('abc','Papel','Gaveta')",
    ),
  );
  await assert.rejects(
    comUsuario(dono, (tx) =>
      tx.exec(
        "insert into produtos(codigo,nome,localizacao) values ('ABC','Cola','Mesa')",
      ),
    ),
    { code: "23505" },
  );
});

test("uma sessão anônima não pode consultar o estoque", async () => {
  await assert.rejects(
    db.transaction(async (tx) => {
      await tx.exec("set local role anon");
      await tx.exec("select codigo from produtos");
    }),
    { code: "42501" },
  );
});
