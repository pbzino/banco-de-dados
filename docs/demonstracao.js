// Catálogo fictício da demonstração. Cada visita começa com os mesmos saldos.
const catalogo = [
  ["Cabo HDMI", 8],
  ["Cabo de rede", 12],
  ["Cabo USB-C", 4],
  ["Adaptador USB-C", 0],
  ["Mouse", 5],
  ["Teclado", 3],
  ["Pen drive", 9],
  ["Leitor de cartão SD", 2],
  ["Carregador de celular", 6],
  ["Fone de ouvido", 4],
  ["Caneta azul", 24],
  ["Lápis preto", 18],
  ["Borracha", 8],
  ["Apontador", 6],
  ["Grampeador", 2],
  ["Caixa de grampos", 7],
  ["Tesoura", 3],
  ["Fita adesiva", 5],
  ["Bloco de notas", 10],
  ["Régua de 30 cm", 4],
];

export function iniciarDemonstracao() {
  return catalogo.map(([nome, quantidade], indice) => {
    const prateleira = 1 + Math.floor(indice / 10);
    const linha = 1 + Math.floor((indice % 10) / 2);
    const coluna = 1 + (indice % 2);
    return {
      id: String(indice + 1),
      codigo: String(indice + 1).padStart(3, "0"),
      nome,
      quantidade,
      localizacao: `Prateleira ${prateleira} · Linha ${linha} · Coluna ${coluna}`,
    };
  });
}
