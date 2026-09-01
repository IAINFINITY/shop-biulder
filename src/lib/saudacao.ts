// A saudação do topo do dashboard.
//
// Mesma ideia do `primeiro-nome.ts` do CRM da Pâmela, e pelo mesmo motivo: o
// risco não é errar o nome, é **saudar pela metade**. "Boa tarde," sem nada
// depois, ou "Boa tarde, comercial4@botta.com.br", é pior que a saudação
// genérica — põe um endereço de e-mail no cabeçalho da tela.
//
// Sem `Date.now()` escondido dentro: a hora entra por parâmetro, senão não há
// como testar a virada das 12 sem mexer no relógio da máquina.

/** Como chamar quem não tem nome utilizável. */
export const TRATAMENTO_GENERICO = "equipe";

export function saudacaoDaHora(agora: Date = new Date()): string {
  const hora = agora.getHours();
  // A madrugada cai em "boa noite" junto com a noite: quem abre o painel às 3h
  // não espera "bom dia", e inventar uma quarta faixa ("boa madrugada") soa
  // estranho num sistema de trabalho.
  if (hora >= 5 && hora < 12) return "Bom dia";
  if (hora >= 12 && hora < 18) return "Boa tarde";
  return "Boa noite";
}

/**
 * O primeiro nome de quem entrou, ou `null` quando não dá para saber.
 *
 * Só o primeiro: "Boa tarde, Ana Paula da Silva Souza" estoura a linha e soa
 * como carta, não como alguém falando.
 */
export function primeiroNome(nome: string | null | undefined): string | null {
  const limpo = String(nome ?? "").trim();
  if (!limpo) return null;
  if (limpo.includes("@")) return null;
  const primeiro = limpo.split(/\s+/)[0];
  return primeiro || null;
}

/** A frase pronta: "Boa tarde, Rafaela". */
export function saudacao(nome: string | null | undefined, agora: Date = new Date()): string {
  return `${saudacaoDaHora(agora)}, ${primeiroNome(nome) ?? TRATAMENTO_GENERICO}`;
}
