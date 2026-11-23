import { urlProjeto, chavePublicavel } from "./config.js";

const el = id => document.getElementById(id);
const informar = texto => { el("mensagem").textContent = texto; };
const campos = ["codigo", "nome", "localizacao"];
const normalizar = valor => valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
let banco, usuario, emEdicao, itens = [], consulta = 0;

function novo() {
  emEdicao = null;
  el("cadastro").reset();
  el("titulo").textContent = "Novo produto";
  el("salvar").textContent = "Cadastrar produto";
  el("cancelar").hidden = true;
}

function mostrarLista() {
  const busca = normalizar(el("busca").value.trim());
  const encontrados = itens.filter(item => campos.some(c => normalizar(item[c]).includes(busca)));
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
      emEdicao = item.id;
      el("quantidade").value = item.quantidade;
      for (const campo of campos) el(campo).value = item[campo];
      el("titulo").textContent = "Editar produto";
      el("salvar").textContent = "Salvar alterações";
      el("cancelar").hidden = false;
      el("codigo").focus();
    };
    linha.insertCell().append(editar);
  }
  el("vazio").textContent = encontrados.length ? "" : busca ? "Nenhum produto encontrado." : "Seu estoque está vazio.";
}

async function carregar() {
  const atual = ++consulta;
  const pagina = 500;
  const registros = [];
  try {
    let inicio = 0;
    while (true) {
      const {data, error} = await banco.from("produtos").select("id,codigo,nome,localizacao,quantidade")
        .order("id").range(inicio, inicio + pagina - 1);
      if (atual !== consulta) return;
      if (error) throw error;
      registros.push(...data);
      if (data.length < pagina) break;
      inicio += pagina;
    }
    itens = registros;
    mostrarLista();
  } catch {
    if (atual === consulta) informar("Falha ao consultar o estoque. Clique em Atualizar lista.");
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
  el("painel").hidden = !id;
  el("sair").hidden = !id;
  el("acesso").hidden = Boolean(id);
  informar("");
  if (id) setTimeout(carregar, 0);
}

el("login").onsubmit = async e => {
  e.preventDefault();
  if (!banco) return;
  const botao = e.target.querySelector("button");
  botao.disabled = true;
  try {
    const {error} = await banco.auth.signInWithPassword({email: el("email").value.trim(), password: el("senha").value});
    if (error) throw error;
    el("senha").value = "";
  } catch { informar("Falha ao entrar. Confira seu e-mail, senha e conexão."); }
  finally { botao.disabled = false; }
};
el("sair").onclick = async () => {
  const {error} = await banco.auth.signOut({scope:"local"});
  if (error) informar("Falha ao sair. Tente novamente.");
};
el("cancelar").onclick = novo;
el("busca").oninput = mostrarLista;
el("recarregar").onclick = () => { informar(""); void carregar(); };
el("cadastro").onsubmit = async e => {
  e.preventDefault();
  if (el("salvar").disabled) return;
  const dados = Object.fromEntries(campos.map(c => [c, el(c).value.trim()]));
  dados.quantidade = el("quantidade").valueAsNumber;
  const dono = usuario;
  el("salvar").disabled = true;
  try {
    const tabela = banco.from("produtos");
    const op = emEdicao ? tabela.update(dados).eq("id", emEdicao) : tabela.insert(dados);
    const {error} = await op.select("id").single();
    if (usuario !== dono) return;
    if (error) { informar(error.code === "23505" ? "Este código já está cadastrado." : "Falha ao salvar. Confira os campos e tente novamente."); return; }
    novo(); el("busca").value = ""; informar("Produto salvo."); await carregar();
  } catch { informar("Falha na conexão. Atualize a lista para verificar o cadastro."); }
  finally { el("salvar").disabled = false; }
};

async function iniciar() {
  if (!urlProjeto || !chavePublicavel.startsWith("sb_publishable_")) {
    informar("Configure a URL e a chave publicável do projeto em config.js.");
    el("login").querySelector("button").disabled = true;
    return;
  }
  try {
    const {createClient} = await import("https://esm.sh/@supabase/supabase-js@2.49.4");
    banco = createClient(urlProjeto, chavePublicavel);
    banco.auth.onAuthStateChange((evento, sessao) => trocarSessao(sessao));
  } catch { informar("Falha ao conectar ao serviço. Atualize a página para tentar novamente."); }
}
iniciar();
