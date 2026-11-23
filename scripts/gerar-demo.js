import { readFile, writeFile } from "node:fs/promises";

// Gera uma cópia autônoma da interface para abrir por duplo clique.
const raiz = new URL("../", import.meta.url);
const ler = (nome) => readFile(new URL(nome, raiz), "utf8");
const html = await ler("docs/index.html");
const catalogo = (await ler("docs/demonstracao.js")).replace(
  "export function",
  "function",
);
const interfaceJS = (await ler("docs/estoque.js")).replace(
  /^import .*?;\s*$/gm,
  "",
);
const icone =
  "data:image/svg+xml;base64," +
  Buffer.from(await ler("docs/icone.svg")).toString("base64");
const estilo = await ler("docs/estilo.css");
const pagina = html
  .replace('<html lang="pt-BR">', '<html lang="pt-BR" data-demonstracao>')
  .replace(/\.\/icone\.svg/g, icone)
  .replace(
    /<link[^>]+href="\.\/estilo\.css"[^>]*>/,
    () => "<style>" + estilo + "</style>",
  )
  .replace(
    /<script type="module" src="\.\/estoque\.js"><\/script>/,
    () =>
      '<script type="module">\n' +
      catalogo +
      "\n" +
      interfaceJS +
      "\n</script>",
  );
await writeFile(new URL("demonstracao.html", raiz), pagina);
