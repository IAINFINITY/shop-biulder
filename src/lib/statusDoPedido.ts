// O estado de um pedido: um vocabulario so, para as tres telas que o mostram.
//
// ## Por que isto existe
//
// A coluna `status` e texto livre, e havia **tres** interpretadores
// independentes dela, todos por `includes` de pedaco de palavra:
//
//   - `AdminOrdersSection.statusFilterKey` decidia a aba;
//   - `OrderAdminCard` decidia rotulo e cor no painel;
//   - `ClientOrderCard` decidia rotulo e cor para o cliente.
//
// Os tres discordavam. O do painel tratava "conclu" como concluido; o do cliente
// nao. O da aba tinha uma gaveta `outros` que **nenhuma aba mostrava**, entao um
// status fora da lista sumia de todas elas menos "Todos".
//
// Era isso o "existe visualmente e nao funciona": o seletor gravava certo — os 42
// pedidos estavam todos em `NOVO CARRINHO` porque ninguem usou, nao porque
// falhasse —, mas o que se escolhia ("Entregue") e onde o pedido aparecia
// ("Concluidos") eram vocabularios diferentes, sem nada na tela ligando um ao
// outro.
//
// ## Por que quatro estados, e nao os tres pedidos
//
// Pesquisa de 25/08/2026 nos tres sistemas de referencia. Todos separam "chegou e
// ninguem pegou" de "alguem esta tratando":
//
//   | sistema     | entrada       | em curso     | fim        | cancelado |
//   |-------------|---------------|--------------|------------|-----------|
//   | Shopify     | Open          | In progress  | Fulfilled  | Cancelled |
//   | WooCommerce | Pending       | Processing   | Completed  | Cancelled |
//   | Bling       | Em aberto     | Em andamento | Atendido   | Cancelado |
//
// Nenhum colapsa os dois primeiros, e a razao e operacional: "ninguem pegou
// ainda" e o sinal mais util de uma fila de pedidos. Com tres estados, um pedido
// novo e um que ja esta sendo separado ficam na mesma aba, e a fila deixa de
// dizer o que falta fazer.
//
// A Shopify separa ainda **status do pedido** (visao do cliente) de **status de
// atendimento** (visao do galpao). Aqui isso vira: o mesmo estado, com rotulo
// unico para as duas telas — e a granularidade de galpao (separando,
// processando) fica para quando alguem pedir, como sub-etapa e nao como mais um
// item na mesma lista.

// ## Os dois estados acrescentados em 31/08/2026
//
// Uma cliente escreveu: *"fiz um pedido dia 28/08 às 14:40, porém não consigo
// acompanhar a evolução, também não recebi nenhum e-mail com informações ou
// formas de pagamento."*
//
// O diagnóstico não era falta de e-mail. Era falta de **estado**: o pedido dela
// estava em "Em andamento" enquanto na verdade esperava o atendente combinar o
// pagamento — que é como este negócio funciona (ver `CatalogOrderNotice`). Nada
// na tela dela podia dizer isso, porque o estado não existia.
//
// Nova pesquisa, agora em referências de B2B por atacado (b2bwave, OroCommerce,
// Adobe Commerce), mostra sete estados típicos: Submitted, Approved, Being
// Prepared, Awaiting Payment, Sent, Complete, Canceled.
//
// **Entram dois, não cinco.** `aguardando_pagamento` porque é o buraco que gerou
// a reclamação, e `enviado` porque é a pergunta seguinte de quem já pagou —
// "saiu?". Approved e Being Prepared ficam de fora pelo mesmo argumento que já
// estava escrito aqui: são granularidade de galpão, e este time tem uma pessoa
// tratando a fila. Estado que ninguém move é estado que mente.

export type StatusDoPedido =
  | "novo"
  | "em_andamento"
  | "aguardando_pagamento"
  | "enviado"
  | "concluido"
  | "cancelado";

/** A ordem em que aparecem na tela — e a ordem do fluxo. */
export const ESTADOS_DO_PEDIDO: readonly StatusDoPedido[] = [
  "novo",
  "em_andamento",
  "aguardando_pagamento",
  "enviado",
  "concluido",
  "cancelado",
];

/**
 * O texto que vai para a coluna `status` em cada estado.
 *
 * `novo` grava **`NOVO CARRINHO`**, e nao `Novo`. Nao e descuido: esse e o valor
 * que o checkout grava desde sempre, que os 42 pedidos ja tem, e que sai no
 * webhook do pedido (`status: payload.status`) para um consumidor externo que
 * este repositorio nao enxerga. Trocar o texto obrigaria a migrar a coluna e a
 * torcer para nada do outro lado depender dele.
 *
 * O que a pessoa **le** e outra coisa — ver `ROTULOS`. Valor guardado, rotulo
 * exibido e agrupamento sao tres coisas distintas, que era justamente o que
 * faltava aqui.
 */
export const VALORES_GRAVADOS: Record<StatusDoPedido, string> = {
  novo: "NOVO CARRINHO",
  em_andamento: "Em andamento",
  aguardando_pagamento: "Aguardando pagamento",
  enviado: "Enviado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export const ROTULOS: Record<StatusDoPedido, string> = {
  novo: "Novo",
  em_andamento: "Em andamento",
  aguardando_pagamento: "Aguardando pagamento",
  enviado: "Enviado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

/** Rotulo no plural, para as abas. */
export const ROTULOS_PLURAL: Record<StatusDoPedido, string> = {
  novo: "Novos",
  em_andamento: "Em andamento",
  aguardando_pagamento: "Aguardando pagamento",
  enviado: "Enviados",
  concluido: "Concluídos",
  cancelado: "Cancelados",
};

/**
 * O que o cliente lê sobre cada estado, na conta dele.
 *
 * É a peça que faltava. A regra do negócio — pagamento combinado com o
 * atendimento, fora da plataforma — só aparecia **antes** de comprar, no aviso
 * do catálogo. Depois de enviar o pedido, a pessoa ficava sem nada: nem estado
 * que explicasse, nem texto que dissesse o que esperar.
 *
 * Escrito na segunda pessoa e dizendo **o que acontece a seguir**, não o que
 * aconteceu. Quem abre a tela quer saber se precisa fazer algo.
 */
export const EXPLICACAO_PARA_O_CLIENTE: Record<StatusDoPedido, string> = {
  novo: "Recebemos seu pedido. Nosso time vai conferir os itens e entrar em contato.",
  em_andamento: "Estamos preparando seu pedido e conferindo as condições comerciais.",
  aguardando_pagamento:
    "Seu pedido está pronto e aguarda o pagamento. Nosso time entra em contato para combinar a forma e as condições — o pagamento não é feito pelo site.",
  enviado: "Seu pedido saiu para entrega.",
  concluido: "Pedido concluído. Obrigado pela compra!",
  cancelado: "Este pedido foi cancelado. Se não foi você quem pediu, fale com o atendimento.",
};

function semAcento(valor: string): string {
  return valor
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * De qualquer texto para um dos quatro estados.
 *
 * Tolerante de proposito. A coluna e texto livre e ja passou por vocabularios
 * diferentes: `NOVO CARRINHO`, `Separando`, `Processando`, `Entregue`. Um pedido
 * antigo, ou um status escrito por integracao, precisa cair no lugar certo sem
 * ninguem migrar nada.
 *
 * **A ordem dos testes importa.** `cancelado` vem primeiro: um pedido cancelado
 * nunca pode ser lido como concluido, e nenhum outro rotulo contem "cancel".
 *
 * O desconhecido cai em `novo`, e nao numa gaveta `outros`. A versao anterior
 * tinha essa gaveta e **nenhuma aba a mostrava** — um status inesperado
 * desaparecia de todas as abas menos "Todos". Cair em `novo` poe o pedido na
 * frente de quem trabalha a fila, que e onde um caso estranho precisa aparecer.
 */
export function normalizarStatusDoPedido(valor: unknown): StatusDoPedido {
  const texto = semAcento(typeof valor === "string" ? valor.trim() : "");
  if (!texto) return "novo";

  if (texto.includes("cancel")) return "cancelado";
  // Só `pagament`, e não `aguardando` solto: "Aguardando retirada" não é
  // aguardando pagamento, e um teste já existia guardando essa distinção. A
  // palavra genérica casaria com qualquer espera.
  if (texto.includes("pagament")) return "aguardando_pagamento";
  // `enviado` antes de `entreg`: "enviado" e "entregue" são coisas diferentes
  // aqui, e um pedido enviado não pode ser lido como concluído.
  if (texto.includes("enviad") || texto.includes("despach")) return "enviado";
  if (texto.includes("conclu") || texto.includes("entreg") || texto.includes("atendid")) return "concluido";
  if (
    texto.includes("andamento") ||
    texto.includes("separ") ||
    texto.includes("process") ||
    texto.includes("prepar")
  ) {
    return "em_andamento";
  }
  return "novo";
}

export function rotuloDoStatus(valor: unknown): string {
  return ROTULOS[normalizarStatusDoPedido(valor)];
}

/**
 * As classes do selo, iguais no painel e na conta do cliente.
 *
 * Estavam duplicadas nas duas telas com regras levemente diferentes: no painel
 * "conclu" ficava verde, na do cliente nao — o mesmo pedido saia cinza para o
 * cliente e verde para o atendimento.
 */
export function classeDoStatus(valor: unknown): string {
  switch (normalizarStatusDoPedido(valor)) {
    case "cancelado":
      return "border-destructive/25 bg-destructive/10 text-destructive";
    case "concluido":
      return "border-success/25 bg-success/10 text-success";
    case "enviado":
      return "border-primary/25 bg-primary/10 text-primary";
    case "aguardando_pagamento":
      return "border-warm/30 bg-warm/10 text-warm";
    case "em_andamento":
      return "border-warm/25 bg-warm/[0.07] text-warm";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}
