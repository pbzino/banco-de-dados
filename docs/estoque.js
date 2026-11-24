import { urlProjeto, chavePublicavel } from "./config.js";

import { iniciarDemonstracao } from "./demonstracao.js";

const portatil = document.documentElement.hasAttribute("data-demonstracao");
const demo =
  portatil || new URLSearchParams(location.search).get("modo") === "demo";
const el = (id) => document.getElementById(id);
const informar = (texto) => {
  el("mensagem").textContent = texto;
};
const campos = ["codigo", "nome", "localizacao"];
const normalizar = (valor) =>
  valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
let banco,
  usuario,
  emEdicao,
  itens = [],
  consulta = 0;

function novo() {
  emEdicao = null;
  el("cadastro").reset();
  el("quantidade").disabled = false;
  el("titulo").textContent = "Novo produto";
  el("salvar").textContent = "Cadastrar produto";
  el("cancelar").hidden = true;
}

function mostrarLista() {
  if (usuario && demo) void atualizarAtividade();
  el("total-produtos").textContent = itens.length;
  el("total-unidades").textContent = itens.reduce(
    (total, item) => total + item.quantidade,
    0,
  );
  const busca = normalizar(el("busca").value.trim());
  const encontrados = itens.filter((item) =>
    campos.some((c) => normalizar(item[c]).includes(busca)),
  );
  el("lista").replaceChildren();
  for (const item of encontrados) {
    const linha = el("lista").insertRow();
    for (const campo of campos) linha.insertCell().textContent = item[campo];
    linha.insertCell().textContent = item.quantidade;
    const editar = document.createElement("button");
    editar.className = "edit";
    editar.textContent = "Editar";
    editar.setAttribute("aria-label", "Editar " + item.nome);
    editar.onclick = () => {
      emEdicao = item;
      el("quantidade").disabled = false;
      el("quantidade").value = item.quantidade;
      for (const campo of campos) el(campo).value = item[campo];
      el("titulo").textContent = "Editar produto";
      el("salvar").textContent = "Salvar alterações";
      el("cancelar").hidden = false;
      el("codigo").focus();
    };
    const mover = document.createElement("button");
    mover.className = "edit";
    mover.textContent = "Entrada";
    mover.onclick = () => abrirMovimento(item);
    const saida = document.createElement("button");
    saida.className = "edit";
    saida.textContent = "Saída";
    saida.onclick = () => abrirMovimento(item, "saida");
    const apagar = document.createElement("button");
    apagar.className = "edit";
    apagar.textContent = "Apagar";
    apagar.onclick = async () => {
      if (!window.confirm("Apagar " + item.codigo + " · " + item.nome + " e todo o histórico deste produto? Essa ação é definitiva.")) return;
      apagar.disabled = true;
      try {
        if (demo) itens = itens.filter(p => p.id !== item.id);
        else {
          const { data, error } = await banco.from("produtos").delete().eq("id",item.id).select("id").single();
          if (error || !data) throw Error("Falha ao apagar. Atualize a lista e tente novamente.");
          await carregar();
        }
        if (emEdicao?.id === item.id) novo();
        mostrarLista();
        informar("Produto apagado.");
      } catch (erro) { informar(erro.message); }
      finally { apagar.disabled = false; }
    };
    linha.insertCell().append(editar, mover, saida, apagar);
  }
  el("vazio").textContent = encontrados.length
    ? ""
    : busca
      ? "Nenhum produto encontrado."
      : "Seu estoque está vazio.";
}

async function carregar() {
  const atual = ++consulta;
  const pagina = 500;
  const registros = [];
  try {
    let inicio = 0;
    while (true) {
      const { data, error } = await banco
        .from("produtos")
        .select("id,codigo,nome,localizacao,quantidade")
        .order("id")
        .range(inicio, inicio + pagina - 1);
      if (atual !== consulta) return;
      if (error) throw error;
      registros.push(...data);
      if (data.length < pagina) break;
      inicio += pagina;
    }
    itens = registros;
    void atualizarAtividade();
    mostrarLista();
  } catch {
    if (atual === consulta)
      informar("Falha ao consultar o estoque. Clique em Atualizar lista.");
  }
}

function trocarSessao(sessao) {
  const id = sessao?.user.id ?? null;
  if (usuario === id) return;
  usuario = id;
  el("atividade").hidden = !id;
  el("recentes").replaceChildren();
  if (el("movimento").open) el("movimento").close();
  consulta++;
  itens = [];
  novo();
  el("lista").replaceChildren();
  el("vazio").textContent = "";
  el("busca").value = "";
  el("resumo").hidden = !id;
  el("painel").hidden = !id;
  el("sair").hidden = !id;
  el("acesso").hidden = Boolean(id);
  informar("");
  if (id && !demo) setTimeout(carregar, 0);
}

el("login").onsubmit = async (e) => {
  e.preventDefault();
  if (!banco) return;
  const botao = e.target.querySelector("button");
  botao.disabled = true;
  try {
    const { error } = await banco.auth.signInWithPassword({
      email: el("email").value.trim(),
      password: el("senha").value,
    });
    if (error) throw error;
    el("senha").value = "";
  } catch {
    informar("Falha ao entrar. Confira seu e-mail, senha e conexão.");
  } finally {
    botao.disabled = false;
  }
};
el("sair").onclick = async () => {
  if (demo) {
    if (portatil) location.reload();
    else location.assign(location.pathname);
    return;
  }
  const { error } = await banco.auth.signOut({ scope: "local" });
  if (error) informar("Falha ao sair. Tente novamente.");
};
el("cancelar").onclick = novo;
el("busca").oninput = mostrarLista;
el("recarregar").onclick = () => {
  informar("");
  void carregar();
};
el("cadastro").onsubmit = async (e) => {
  e.preventDefault();
  if (el("salvar").disabled) return;
  const dados = Object.fromEntries(campos.map((c) => [c, el(c).value.trim()]));
  dados.quantidade = el("quantidade").valueAsNumber;
  if (campos.some((campo) => !dados[campo])) {
    informar("Preencha código, nome e localização.");
    return;
  }
  let motivo = null;
  if (emEdicao && dados.quantidade !== emEdicao.quantidade) {
    motivo = window.prompt("Qual o motivo do ajuste de quantidade?")?.trim();
    if (!motivo) { informar("Informe um motivo para salvar o ajuste."); return; }
  }
  if (demo) {
    const duplicado = itens.some(
      (item) =>
        item.id !== emEdicao?.id &&
        item.codigo.toUpperCase() === dados.codigo.toUpperCase(),
    );
    if (duplicado) {
      informar("Este código já está cadastrado.");
      return;
    }
    if (emEdicao) {
      if (motivo) historicoDemo.unshift({produto_id:emEdicao.id, tipo:"ajuste", quantidade:dados.quantidade,
        saldo_anterior:emEdicao.quantidade, saldo_final:dados.quantidade, motivo, criado_em:new Date(), responsavel:usuario});
      Object.assign(emEdicao, dados);
    }
    else itens.unshift({ id: crypto.randomUUID(), ...dados });
    novo();
    el("busca").value = "";
    mostrarLista();
    informar("Produto salvo na demonstração.");
    return;
  }
  const dono = usuario;
  el("salvar").disabled = true;
  try {
    const tabela = banco.from("produtos");
    // Só grava se o registro continuar igual ao que foi aberto no formulário.
    const {data, error} = emEdicao
      ? await banco.rpc("editar_produto", {p_id:emEdicao.id, p_original:emEdicao,
          p_codigo:dados.codigo, p_nome:dados.nome, p_localizacao:dados.localizacao,
          p_quantidade:dados.quantidade, p_motivo:motivo})
      : await tabela.insert(dados).select("id").single();
    if (usuario !== dono) return;
    if (error) {
      informar(
        error.code === "23505"
          ? "Este código já está cadastrado."
          : error.message,
      );
      return;
    }
    if (!data) {
      await carregar();
      informar(
        "O registro mudou. Clique em Editar novamente para conferir o saldo atual.",
      );
      return;
    }
    novo();
    el("busca").value = "";
    informar("Produto salvo.");
    await carregar();
  } catch {
    informar("Falha na conexão. Atualize a lista para verificar o cadastro.");
  } finally {
    el("salvar").disabled = false;
  }
};

let produtoMov, pedido;
const historicoDemo = [];
const tipos = { entrada: "Entrada", saida: "Saída", ajuste: "Ajuste" };


function descrever(tipo, quantidade, nome, saldo) {
  if (tipo === "ajuste") return nome + " · Saldo ajustado para " + saldo + ".";
  const unidade = quantidade === 1 ? " unidade" : " unidades";
  return tipos[tipo] + " de " + quantidade + unidade + " de " + nome + " · Saldo: " + saldo + ".";
}
let versaoAtividade = 0;
async function atualizarAtividade() {
  const versao = ++versaoAtividade, conta = usuario;
  const lista = el("recentes");
  let registros;
  try {
    if (demo) {
      registros = historicoDemo.filter(m => itens.some(p => p.id === m.produto_id)).slice(0, 5)
        .map(m => ({...m, produtos: itens.find(p => p.id === m.produto_id)}));
    } else {
      const {data,error} = await banco.from("movimentacoes")
        .select("tipo,quantidade,saldo_final,criado_em,produtos(nome)")
        .order("criado_em",{ascending:false}).limit(5);
      if (error) throw error;
      registros = data;
    }
    if (conta !== usuario || versao !== versaoAtividade) return;
    lista.replaceChildren();
    for (const m of registros) {
      const li = document.createElement("li");
      li.textContent = new Date(m.criado_em).toLocaleString("pt-BR") + " · " +
        descrever(m.tipo, m.quantidade, m.produtos?.nome ?? "produto", m.saldo_final);
      lista.append(li);
    }
    if (!registros.length) lista.textContent = "Nenhuma movimentação registrada.";
  } catch {
    if (conta === usuario && versao === versaoAtividade) lista.textContent = "Falha ao carregar as movimentações.";
  }
}
setInterval(() => {
  if (usuario && !demo && !document.hidden) void atualizarAtividade();
}, 30000);

async function listarHistorico(item) {
  const lista = el("historico");
  lista.replaceChildren();
  let linhas;
  if (demo) linhas = historicoDemo.filter((m) => m.produto_id === item.id);
  else {
    const { data, error } = await banco
      .from("movimentacoes")
      .select(
        "tipo,quantidade,saldo_anterior,saldo_final,motivo,criado_em,responsavel",
      )
      .eq("produto_id", item.id)
      .order("criado_em", { ascending: false })
      .limit(50);
    if (produtoMov !== item || !el("movimento").open) return;
    if (error) {
      lista.textContent = "Falha ao carregar histórico.";
      return;
    }
    linhas = data;
  }
  lista.replaceChildren();
  if (!linhas.length) lista.textContent = "Nenhuma movimentação registrada.";
  for (const m of linhas) {
    const li = document.createElement("li");
    const autor = m.responsavel === usuario ? "Você" : m.responsavel;
    li.textContent = [
      new Date(m.criado_em).toLocaleString("pt-BR"),
      autor,
      tipos[m.tipo] + " (" + m.quantidade + ")",
      "Saldo " + m.saldo_anterior + " → " + m.saldo_final,
      m.motivo,
    ]
      .filter(Boolean)
      .join(" · ");
    lista.append(li);
  }
}

function configurarOperacao() {
  const ajuste = el("tipo-mov").value === "ajuste";
  el("rotulo-valor").textContent = ajuste ? "Novo saldo contado" : "Unidades";
  el("valor-mov").min = ajuste ? "0" : "1";
  el("motivo-mov").required = ajuste;
}
function abrirMovimento(item, tipoInicial = "entrada") {
  produtoMov = item;
  pedido = crypto.randomUUID();
  el("operacao").reset();
  el("tipo-mov").value = tipoInicial;
  configurarOperacao();
  el("produto-mov").textContent = item.codigo + " · " + item.nome;
  el("saldo-mov").textContent = "Saldo atual: " + item.quantidade;
  el("aviso-mov").textContent = "";
  el("movimento").showModal();
  void listarHistorico(item);
}
el("tipo-mov").onchange = configurarOperacao;
el("operacao").oninput = () => {
  pedido = crypto.randomUUID();
};
el("fechar-mov").onclick = () => el("movimento").close();
el("movimento").oncancel = (e) => {
  if (el("registrar").disabled) e.preventDefault();
};
el("operacao").onsubmit = async (e) => {
  e.preventDefault();
  if (el("registrar").disabled) return;
  const item = produtoMov,
    tipo = el("tipo-mov").value,
    qtd = el("valor-mov").valueAsNumber;
  const motivo = el("motivo-mov").value.trim();
  const sessao = usuario;
  let saldoRegistrado;
  if (tipo === "ajuste" && !motivo) {
    el("aviso-mov").textContent = "Informe o motivo do ajuste.";
    return;
  }
  el("registrar").disabled = el("fechar-mov").disabled = true;
  try {
    if (demo) {
      const antes = item.quantidade;
      const saldo =
        tipo === "ajuste" ? qtd : antes + (tipo === "entrada" ? qtd : -qtd);
      if (saldo < 0) throw Error("Saldo insuficiente.");
      if (saldo > 2147483647) throw Error("Saldo acima do limite.");
      saldoRegistrado = saldo;
      item.quantidade = saldo;
      historicoDemo.unshift({
        produto_id: item.id,
        tipo,
        quantidade: qtd,
        motivo,
        criado_em: new Date(),
        responsavel: usuario,
        saldo_anterior: antes,
        saldo_final: saldo,
      });
      mostrarLista();
    } else {
      const { data, error } = await banco.rpc("movimentar", {
        p_produto: item.id,
        p_tipo: tipo,
        p_quantidade: qtd,
        p_motivo: motivo,
        p_solicitacao: pedido,
        p_saldo_esperado: item.quantidade,
      });
      if (error) throw Error(error.message);
      saldoRegistrado = data;
      if (usuario !== sessao) return;
      await carregar();
    }
    el("movimento").close();
    informar(descrever(tipo, qtd, item.nome, saldoRegistrado));
  } catch (erro) {
    el("aviso-mov").textContent = erro.message;
  } finally {
    el("registrar").disabled = el("fechar-mov").disabled = false;
  }
};

async function iniciar() {
  if (demo) {
    trocarSessao({ user: { id: "demo" } });
    itens = iniciarDemonstracao();
    el("descricao").textContent =
      "Demonstração com dados fictícios. As alterações duram até recarregar a página.";
    el("abrir-demo").hidden = true;
    el("recarregar").hidden = true;
    el("sair").textContent = portatil
      ? "Reiniciar demonstração"
      : "Sair da demonstração";
    mostrarLista();
    return;
  }
  if (!urlProjeto || !chavePublicavel.startsWith("sb_publishable_")) {
    informar("Configure a URL e a chave publicável do projeto em config.js.");
    el("login").querySelector("button").disabled = true;
    return;
  }
  try {
    const { createClient } = await import(
      "https://esm.sh/@supabase/supabase-js@2.49.4"
    );
    banco = createClient(urlProjeto, chavePublicavel);
    banco.auth.onAuthStateChange((evento, sessao) => trocarSessao(sessao));
  } catch {
    informar(
      "Falha ao conectar ao serviço. Atualize a página para tentar novamente.",
    );
  }
}
iniciar();
