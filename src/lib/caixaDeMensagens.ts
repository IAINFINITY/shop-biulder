// A caixa de mensagens do atendimento: em que pé está cada conversa.
//
// ## O que faltava
//
// "eu tô vendo aqui um cliente que mandou mensagem pro pessoal, mas ninguém é
// notificado sobre isso dentro da plataforma."
//
// A lista mostrava todas as conversas em ordem de data e nada mais. Um cliente
// que escreveu e ficou sem resposta tem exatamente a mesma aparência de um que
// já foi atendido — a única forma de saber era abrir uma por uma.
//
// ## O sinal é "esperando", não "não lido"
//
// A saída óbvia era lido/não lido, como no e-mail. Em caixa de **equipe** ela
// falha de um jeito conhecido: o primeiro atendente que abre marca como lida
// para todo mundo, e a conversa some do radar sem ninguém ter respondido. O
// aviso vira função de quem olhou, não de quem precisa de resposta.
//
// O sinal usado aqui não se apaga por engano:
//
//   última mensagem do cliente → ninguém respondeu ainda.
//
// Ele é o mesmo para os quatro atendentes, sobrevive a recarregar a tela, e
// responde a pergunta que importa ("quem está esperando?") em vez da pergunta
// parecida ("o que eu ainda não vi?"). Quem responde, tira a conversa da fila —
// e é a resposta que tira, que é o comportamento certo.
//
// A referência que serviu de padrão separa "esperando" de "paradas" pelo mesmo
// motivo: cliente que espera pede resposta, cliente que sumiu pede um cutucão.
// São ações opostas e não podem cair no mesmo balde.

import type { SupportConversation } from "./supportChat";

export type EstadoDaConversa =
  /** O cliente falou por último. Ninguém respondeu. */
  | "esperando"
  /** A última palavra é nossa. A bola está com o cliente. */
  | "respondida"
  /** Aberta ao entrar na tela de mensagens, sem nunca ter enviado nada. */
  | "sem_mensagem"
  | "finalizada";

/**
 * Se o atendimento está encerrado **agora**.
 *
 * ⚠️ É uma comparação de datas, e não um booleano — e essa é a decisão inteira.
 *
 * Com `status = 'closed'`, encerrar e o cliente responder em seguida deixaria a
 * conversa fora da lista **com uma mensagem nova dentro**: ninguém saberia que
 * existe algo para reabrir, e o cliente ficaria falando sozinho. Comparando as
 * datas, a mensagem nova é mais recente que o encerramento e **reabre a
 * conversa sozinha** — sem gatilho de reabertura, sem evento para processar,
 * sem nada que possa falhar em silêncio.
 *
 * Mensagem no mesmo instante do encerramento continua encerrada (`>=`): é o
 * atendente despedindo-se e fechando, não um cliente voltando.
 */
export function estaFinalizada(conversa: SupportConversation): boolean {
  // `closed`/`archived` são o esquema antigo. Nenhuma conversa em produção
  // chegou a usá-los — não havia botão —, mas alguém pode escrever direto no
  // banco, e nesse caso a intenção é clara demais para ser ignorada.
  if (conversa.status === "closed" || conversa.status === "archived") return true;
  if (!conversa.finalizada_em) return false;
  if (!conversa.last_message_at) return true;
  return new Date(conversa.finalizada_em).getTime() >= new Date(conversa.last_message_at).getTime();
}

export function estadoDaConversa(conversa: SupportConversation): EstadoDaConversa {
  if (estaFinalizada(conversa)) return "finalizada";

  // Sem `last_message_preview` a conversa nasceu de um clique, não de uma
  // mensagem: o cliente abriu a seção e fechou. Ela continua na lista — dá para
  // puxar assunto — mas não pode contar como alguém esperando resposta, senão o
  // aviso da barra lateral fica permanentemente aceso sem nada a fazer.
  if (!conversa.last_message_preview?.trim()) return "sem_mensagem";

  return conversa.ultima_mensagem_de === "customer" ? "esperando" : "respondida";
}

// ---------------------------------------------------------------------------
// Há quanto tempo espera
// ---------------------------------------------------------------------------

export type UrgenciaDaEspera = "normal" | "atencao" | "urgente";

/** Meia jornada sem resposta pede atenção; um dia inteiro é falha. */
const HORAS_ATE_ATENCAO = 4;
const HORAS_ATE_URGENTE = 24;

export function horasEsperando(conversa: SupportConversation, agora = new Date()): number | null {
  if (estadoDaConversa(conversa) !== "esperando" || !conversa.last_message_at) return null;
  const desde = new Date(conversa.last_message_at).getTime();
  if (!Number.isFinite(desde)) return null;
  return Math.max(0, (agora.getTime() - desde) / 3_600_000);
}

/**
 * Quão atrasada está a resposta.
 *
 * ⚠️ **Conservador de propósito.** A referência avisa que pintar tudo de
 * vermelho treina a equipe a ignorar a cor, e ela tem razão: se as dez linhas
 * da tela são vermelhas, nenhuma é. Aqui só passa de um dia útil inteiro sem
 * resposta é que a linha fica vermelha.
 *
 * O CRM de referência mede a **margem que resta** na janela de 24h do WhatsApp,
 * e não o tempo parado. Aqui não existe essa janela — o chat é nosso e não
 * expira —, então o que sobra para medir é a espera mesmo.
 */
export function urgenciaDaEspera(conversa: SupportConversation, agora = new Date()): UrgenciaDaEspera | null {
  const horas = horasEsperando(conversa, agora);
  if (horas == null) return null;
  if (horas >= HORAS_ATE_URGENTE) return "urgente";
  if (horas >= HORAS_ATE_ATENCAO) return "atencao";
  return "normal";
}

/** "40min", "6h", "11d" — cabe na linha da lista, que é onde isso vai. */
export function duracaoCurta(horas: number): string {
  if (horas < 1) return `${Math.max(1, Math.round(horas * 60))}min`;
  if (horas < 24) return `${Math.floor(horas)}h`;
  return `${Math.floor(horas / 24)}d`;
}

// ---------------------------------------------------------------------------
// A caixa
// ---------------------------------------------------------------------------

export type FiltroDaCaixa = "todas" | EstadoDaConversa;

export function contarPorEstado(conversas: readonly SupportConversation[]): Record<FiltroDaCaixa, number> {
  const contagem: Record<FiltroDaCaixa, number> = {
    todas: 0,
    esperando: 0,
    respondida: 0,
    sem_mensagem: 0,
    finalizada: 0,
  };

  for (const conversa of conversas) contagem[estadoDaConversa(conversa)] += 1;

  // "Todas" não inclui as encerradas: elas saíram da caixa, é para isso que
  // serve encerrar. Ficam na própria aba, para quem precisa consultar.
  contagem.todas = conversas.length - contagem.finalizada;
  return contagem;
}

/** O número do aviso: quantas pessoas estão esperando resposta agora. */
export function quantasEsperando(conversas: readonly SupportConversation[]): number {
  return conversas.filter((conversa) => estadoDaConversa(conversa) === "esperando").length;
}

function combinaComABusca(conversa: SupportConversation, termo: string): boolean {
  if (!termo) return true;
  // A prévia entra na busca junto com nome, empresa e CNPJ: quem lembra do
  // assunto ("boleto") e não do nome do cliente também acha — é assim na
  // referência, e é como se procura uma conversa de que se lembra pela metade.
  return [
    conversa.customer_name,
    conversa.customer_company,
    conversa.customer_cnpj,
    conversa.subject,
    conversa.last_message_preview,
  ].some((campo) => (campo ?? "").toLowerCase().includes(termo));
}

/**
 * A fila, na ordem em que se trabalha nela.
 *
 * Quem espera vem primeiro — é a razão de a tela existir —, e dentro da fila
 * **quem espera há mais tempo na frente**, que é o oposto da ordem por mensagem
 * mais recente: numa fila, quem chegou antes é atendido antes, senão o cliente
 * de onze dias atrás nunca chega ao topo.
 *
 * Depois vêm as respondidas (mais recente primeiro, que é a ordem de conversa),
 * as vazias, e por último as encerradas.
 */
export function organizarCaixa(
  conversas: readonly SupportConversation[],
  { filtro = "todas" as FiltroDaCaixa, busca = "" } = {},
): SupportConversation[] {
  const termo = busca.trim().toLowerCase();

  const peso: Record<EstadoDaConversa, number> = {
    esperando: 0,
    respondida: 1,
    sem_mensagem: 2,
    finalizada: 3,
  };

  return conversas
    .filter((conversa) => {
      if (!combinaComABusca(conversa, termo)) return false;
      const estado = estadoDaConversa(conversa);
      // Encerrada só aparece na aba dela. Em "Todas" ela voltaria a ocupar a
      // tela logo depois de alguém ter encerrado, que é o contrário do pedido.
      if (filtro === "todas") return estado !== "finalizada";
      return estado === filtro;
    })
    .sort((a, b) => {
      const estadoA = estadoDaConversa(a);
      const diferenca = peso[estadoA] - peso[estadoDaConversa(b)];
      if (diferenca !== 0) return diferenca;

      const tempoA = new Date(a.last_message_at).getTime();
      const tempoB = new Date(b.last_message_at).getTime();
      return estadoA === "esperando" ? tempoA - tempoB : tempoB - tempoA;
    });
}

/**
 * As iniciais do círculo do cliente.
 *
 * Mora aqui, e não na lista, porque o cabeçalho da conversa mostra o **mesmo**
 * círculo — é o que amarra "a linha que eu cliquei" a "a conversa que abriu".
 * Duas cópias divergiriam no primeiro nome composto.
 */
export function iniciaisDoCliente(valor: string | null | undefined): string {
  const limpo = (valor ?? "").trim();
  if (!limpo) return "?";
  const partes = limpo.split(/\s+/).slice(0, 2);
  return partes.map((parte) => parte[0]?.toUpperCase() ?? "").join("") || "?";
}

export const ROTULO_DO_FILTRO: Record<FiltroDaCaixa, string> = {
  todas: "Todas",
  esperando: "Esperando",
  respondida: "Respondidas",
  sem_mensagem: "Sem mensagem",
  finalizada: "Finalizadas",
};
