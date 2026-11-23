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
  el("titulo").textContent = "Novo produto";
  el("salvar").textContent = "Cadastrar produto";
  el("cancelar").hidden = true;
}

function mostrarLista() {
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
      el("quantidade").value = item.quantidade;
      for (const campo of campos) el(campo).value = item[campo];
      el("titulo").textContent = "Editar produto";
      el("salvar").textContent = "Salvar alterações";
      el("cancelar").hidden = false;
      el("codigo").focus();
    };
    linha.insertCell().append(editar);
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
    if (emEdicao) Object.assign(emEdicao, dados);
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
    const op = emEdicao
      ? tabela.update(dados).match(emEdicao)
      : tabela.insert(dados);
    const { data, error } = await op.select("id").maybeSingle();
    if (usuario !== dono) return;
    if (error) {
      informar(
        error.code === "23505"
          ? "Este código já está cadastrado."
          : "Falha ao salvar. Confira os campos e tente novamente.",
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
