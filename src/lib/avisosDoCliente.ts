// Que cara tem cada aviso da conta do cliente.
//
// ## Por que existe
//
// A lista de notificações era uma coluna de cartões iguais: mesmo ícone
// genérico, mesma cor, mesmo peso. "Seu pedido foi cancelado" e "Promoção de
// setembro" chegavam com a mesma aparência, e o olho não separava o que exige
// ação do que é convite.
//
// ⚠️ **O tipo vem do banco, e não do título.** Ler `title.includes("enviado")`
// seria repetir o erro que `normalizarStatusDoPedido` já teve: "aguardando
// retirada" casava com "aguardando" e virava "aguardando pagamento". Título é
// texto para humano — muda quando alguém melhora a frase, e o ícone mudaria
// junto sem ninguém pedir.

export type TipoDeAvisoAoCliente =
  | "campanha"
  | "pedido_recebido"
  | "pedido_em_andamento"
  | "pedido_aguardando_pagamento"
  | "pedido_enviado"
  | "pedido_concluido"
  | "pedido_cancelado"
  | "atendimento_aberto"
  | "atendimento_encerrado";

/** O tom do aviso — decide a cor do ícone e do selo. */
export type TomDoAviso = "neutro" | "andamento" | "atencao" | "sucesso" | "problema";

export type AparenciaDoAviso = {
  /** Nome do ícone do `lucide-react`. A tela resolve o componente. */
  icone: string;
  tom: TomDoAviso;
  /** Uma palavra sobre o que aconteceu, ao lado do título. */
  rotulo: string;
};

/**
 * A aparência de cada tipo.
 *
 * ## As cores não são decorativas
 *
 * - **atenção** (âmbar) só em `aguardando_pagamento`: é o único que espera algo
 *   de quem lê.
 * - **problema** (vermelho) só em `cancelado`.
 * - **sucesso** (verde) no que fechou bem.
 * - o resto é neutro ou "em andamento", que informam sem pedir nada.
 *
 * Se tudo fosse colorido, nada seria — é a mesma regra da fila de mensagens.
 */
const APARENCIA: Record<TipoDeAvisoAoCliente, AparenciaDoAviso> = {
  campanha: { icone: "Megaphone", tom: "neutro", rotulo: "Novidade" },
  pedido_recebido: { icone: "PackageCheck", tom: "neutro", rotulo: "Recebido" },
  pedido_em_andamento: { icone: "Loader", tom: "andamento", rotulo: "Em andamento" },
  pedido_aguardando_pagamento: { icone: "Wallet", tom: "atencao", rotulo: "Aguardando pagamento" },
  pedido_enviado: { icone: "Truck", tom: "andamento", rotulo: "Enviado" },
  pedido_concluido: { icone: "CircleCheckBig", tom: "sucesso", rotulo: "Concluído" },
  pedido_cancelado: { icone: "CircleX", tom: "problema", rotulo: "Cancelado" },
  atendimento_aberto: { icone: "MessageSquareText", tom: "neutro", rotulo: "Atendimento" },
  atendimento_encerrado: { icone: "MessageSquareReply", tom: "sucesso", rotulo: "Atendimento" },
};

export function ehTipoDeAvisoConhecido(tipo: string): tipo is TipoDeAvisoAoCliente {
  return tipo in APARENCIA;
}

/**
 * A aparência de um aviso.
 *
 * Tipo desconhecido — gravado por uma versão mais nova do banco — cai em
 * `campanha`: o aviso ainda aparece, com um ícone genérico, em vez de sumir da
 * lista ou quebrar a tela.
 */
export function aparenciaDoAviso(tipo: string | null | undefined): AparenciaDoAviso {
  const chave = (tipo ?? "").trim();
  return ehTipoDeAvisoConhecido(chave) ? APARENCIA[chave] : APARENCIA.campanha;
}

/** As classes de cada tom: círculo do ícone e cor do texto do selo. */
export const CLASSES_DO_TOM: Record<TomDoAviso, { circulo: string; texto: string }> = {
  neutro: { circulo: "border-border bg-muted text-muted-foreground", texto: "text-muted-foreground" },
  andamento: { circulo: "border-primary/20 bg-primary/10 text-primary", texto: "text-primary" },
  // `text-warm` e não `text-warm-foreground`: o *-foreground é branco, feito
  // para ficar SOBRE o warm sólido — aqui o fundo é o warm a 10%.
  atencao: { circulo: "border-warm/25 bg-warm/10 text-warm", texto: "text-warm" },
  sucesso: { circulo: "border-success/20 bg-success/10 text-success", texto: "text-success" },
  problema: { circulo: "border-destructive/20 bg-destructive/10 text-destructive", texto: "text-destructive" },
};
