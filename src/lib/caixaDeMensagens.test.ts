import { describe, expect, it } from "vitest";
import type { SupportConversation } from "./supportChat";
import {
  contarPorEstado,
  duracaoCurta,
  estadoDaConversa,
  estaFinalizada,
  horasEsperando,
  organizarCaixa,
  quantasEsperando,
  urgenciaDaEspera,
} from "./caixaDeMensagens";

function conversa(partes: Partial<SupportConversation> = {}): SupportConversation {
  return {
    id: "1",
    customer_user_id: "u",
    customer_name: "Ana",
    customer_company: "Clinica Sol",
    customer_phone: null,
    customer_cnpj: "12345678000199",
    assigned_admin_id: null,
    subject: null,
    status: "open",
    last_message_preview: "Bom dia, gostaria de um orcamento",
    last_message_at: "2026-08-31T12:00:00Z",
    ultima_mensagem_de: "customer",
    finalizada_em: null,
    finalizada_por: null,
    customer_typing_at: null,
    admin_typing_at: null,
    created_at: "2026-08-30T12:00:00Z",
    updated_at: "2026-08-31T12:00:00Z",
    ...partes,
  };
}

describe("estadoDaConversa", () => {
  it("cliente falou por ultimo: esta esperando resposta", () => {
    expect(estadoDaConversa(conversa({ ultima_mensagem_de: "customer" }))).toBe("esperando");
  });

  it("nos falamos por ultimo: a bola esta com o cliente", () => {
    expect(estadoDaConversa(conversa({ ultima_mensagem_de: "admin" }))).toBe("respondida");
  });

  // A conversa nasce quando o cliente abre a secao Mensagens, sem enviar nada.
  // Quatro das oito conversas em producao sao assim. Se contassem como
  // esperando, o aviso da barra lateral ficaria aceso para sempre.
  it("aberta sem nunca ter mandado nada nao conta como esperando", () => {
    expect(estadoDaConversa(conversa({ last_message_preview: null, ultima_mensagem_de: null }))).toBe("sem_mensagem");
    expect(estadoDaConversa(conversa({ last_message_preview: "   " }))).toBe("sem_mensagem");
  });

  // Fechar e a saida de quem nao quer mais ver aquilo na fila. Se o estado
  // continuasse valendo, a conversa voltaria a piscar depois de resolvida.
  it("finalizada ganha do resto, mesmo com o cliente falando por ultimo", () => {
    expect(estadoDaConversa(conversa({ status: "closed", ultima_mensagem_de: "customer" }))).toBe("finalizada");
    expect(estadoDaConversa(conversa({ status: "archived" }))).toBe("finalizada");
  });

  // As conversas anteriores a migration ficam sem valor se nao tiverem
  // mensagem. Com mensagem e sem coluna, tratar como respondida evita inventar
  // urgencia que ninguem confirmou.
  it("sem a coluna preenchida nao inventa que alguem espera", () => {
    expect(estadoDaConversa(conversa({ ultima_mensagem_de: null }))).toBe("respondida");
  });
});

describe("quantasEsperando", () => {
  it("conta so quem de fato espera", () => {
    const caixa = [
      conversa({ id: "a", ultima_mensagem_de: "customer" }),
      conversa({ id: "b", ultima_mensagem_de: "admin" }),
      conversa({ id: "c", ultima_mensagem_de: "customer", status: "closed" }),
      conversa({ id: "d", last_message_preview: null }),
      conversa({ id: "e", ultima_mensagem_de: "customer" }),
    ];
    expect(quantasEsperando(caixa)).toBe(2);
  });

  it("caixa vazia nao mostra aviso", () => {
    expect(quantasEsperando([])).toBe(0);
  });
});

describe("contarPorEstado", () => {
  it("cada conversa cai em um balde so", () => {
    const caixa = [
      conversa({ id: "a", ultima_mensagem_de: "customer" }),
      conversa({ id: "b", ultima_mensagem_de: "admin" }),
      conversa({ id: "c", status: "closed" }),
      conversa({ id: "d", last_message_preview: null }),
    ];
    expect(contarPorEstado(caixa)).toMatchObject({ esperando: 1, respondida: 1, finalizada: 1, sem_mensagem: 1 });
  });

  // Encerrar tem que esvaziar a caixa, senao encerrar nao serve para nada: a
  // conversa sairia da fila e continuaria contando no numero de cima.
  it("a encerrada sai de Todas", () => {
    const caixa = [
      conversa({ id: "a", ultima_mensagem_de: "customer" }),
      conversa({ id: "b", finalizada_em: "2026-08-31T13:00:00Z" }),
    ];
    expect(contarPorEstado(caixa).todas).toBe(1);
  });
});

describe("organizarCaixa", () => {
  it("quem espera vem primeiro, mesmo sendo a mensagem mais antiga", () => {
    const caixa = [
      conversa({ id: "recente", ultima_mensagem_de: "admin", last_message_at: "2026-08-31T18:00:00Z" }),
      conversa({ id: "antiga", ultima_mensagem_de: "customer", last_message_at: "2026-08-29T09:00:00Z" }),
    ];
    expect(organizarCaixa(caixa).map((c) => c.id)).toEqual(["antiga", "recente"]);
  });

  // Fila e fila: quem chegou antes e atendido antes. Com a ordem de "mensagem
  // mais recente primeiro", o cliente que espera ha onze dias afundaria mais a
  // cada mensagem nova de outra pessoa e nunca chegaria ao topo.
  it("na fila, quem espera ha mais tempo vem primeiro", () => {
    const caixa = [
      conversa({ id: "hoje", ultima_mensagem_de: "customer", last_message_at: "2026-08-31T09:00:00Z" }),
      conversa({ id: "ontem", ultima_mensagem_de: "customer", last_message_at: "2026-08-30T09:00:00Z" }),
    ];
    expect(organizarCaixa(caixa).map((c) => c.id)).toEqual(["ontem", "hoje"]);
  });

  it("fora da fila, a mais recente no topo — que e a ordem de conversa", () => {
    const caixa = [
      conversa({ id: "ontem", ultima_mensagem_de: "admin", last_message_at: "2026-08-30T09:00:00Z" }),
      conversa({ id: "hoje", ultima_mensagem_de: "admin", last_message_at: "2026-08-31T09:00:00Z" }),
    ];
    expect(organizarCaixa(caixa).map((c) => c.id)).toEqual(["hoje", "ontem"]);
  });

  it("as vazias ficam no fim, e a encerrada nem aparece", () => {
    const caixa = [
      conversa({ id: "vazia", last_message_preview: null, last_message_at: "2026-08-31T23:00:00Z" }),
      conversa({ id: "fechada", status: "closed" }),
      conversa({ id: "espera", ultima_mensagem_de: "customer" }),
    ];
    expect(organizarCaixa(caixa).map((c) => c.id)).toEqual(["espera", "vazia"]);
    expect(organizarCaixa(caixa, { filtro: "finalizada" }).map((c) => c.id)).toEqual(["fechada"]);
  });

  it("a busca alcanca a previa da mensagem", () => {
    const caixa = [
      conversa({ id: "a", customer_name: "Ana", last_message_preview: "duvida sobre o boleto" }),
      conversa({ id: "b", customer_name: "Bruno", last_message_preview: "quero mais whey" }),
    ];
    expect(organizarCaixa(caixa, { busca: "boleto" }).map((c) => c.id)).toEqual(["a"]);
  });

  it("o filtro recorta por estado", () => {
    const caixa = [
      conversa({ id: "a", ultima_mensagem_de: "customer" }),
      conversa({ id: "b", ultima_mensagem_de: "admin" }),
    ];
    expect(organizarCaixa(caixa, { filtro: "esperando" }).map((c) => c.id)).toEqual(["a"]);
    expect(organizarCaixa(caixa, { filtro: "respondida" }).map((c) => c.id)).toEqual(["b"]);
  });

  it("busca por nome, empresa e CNPJ", () => {
    const caixa = [
      conversa({ id: "a", customer_name: "Ana", customer_company: "Clinica Sol", customer_cnpj: "111" }),
      conversa({ id: "b", customer_name: "Bruno", customer_company: "Vida Farma", customer_cnpj: "222" }),
    ];
    expect(organizarCaixa(caixa, { busca: "bruno" }).map((c) => c.id)).toEqual(["b"]);
    expect(organizarCaixa(caixa, { busca: "SOL" }).map((c) => c.id)).toEqual(["a"]);
    expect(organizarCaixa(caixa, { busca: "222" }).map((c) => c.id)).toEqual(["b"]);
  });

  // Buscar dentro de um filtro tem que respeitar os dois, senao o resultado
  // parece ignorar a aba em que a pessoa esta.
  it("busca e filtro valem juntos", () => {
    const caixa = [
      conversa({ id: "a", customer_name: "Ana", ultima_mensagem_de: "customer" }),
      conversa({ id: "b", customer_name: "Ana Paula", ultima_mensagem_de: "admin" }),
    ];
    expect(organizarCaixa(caixa, { filtro: "esperando", busca: "ana" }).map((c) => c.id)).toEqual(["a"]);
  });

  it("nao altera a lista que recebeu", () => {
    const caixa = [
      conversa({ id: "a", ultima_mensagem_de: "admin" }),
      conversa({ id: "b", ultima_mensagem_de: "customer" }),
    ];
    organizarCaixa(caixa);
    expect(caixa.map((c) => c.id)).toEqual(["a", "b"]);
  });
});

// ---------------------------------------------------------------------------
// Encerrar o atendimento
// ---------------------------------------------------------------------------

describe("estaFinalizada", () => {
  it("conversa que ninguem encerrou continua na caixa", () => {
    expect(estaFinalizada(conversa({ finalizada_em: null }))).toBe(false);
  });

  it("encerrada depois da ultima mensagem sai da caixa", () => {
    expect(
      estaFinalizada(conversa({ last_message_at: "2026-08-30T10:00:00Z", finalizada_em: "2026-08-31T10:00:00Z" })),
    ).toBe(true);
  });

  // O coracao do desenho. Com um booleano, a resposta do cliente ficaria
  // invisivel ate alguem reabrir na mao — e ninguem saberia que ha o que
  // reabrir. Aqui a comparacao de datas resolve sozinha, sem depender de nenhum
  // gatilho de reabertura ter rodado.
  it("mensagem nova DEPOIS do encerramento reabre sozinha", () => {
    expect(
      estaFinalizada(conversa({ last_message_at: "2026-08-31T18:00:00Z", finalizada_em: "2026-08-31T10:00:00Z" })),
    ).toBe(false);
  });

  // O atendente se despede e fecha: as duas coisas caem no mesmo segundo.
  it("mensagem no mesmo instante do encerramento continua encerrada", () => {
    const instante = "2026-08-31T10:00:00Z";
    expect(estaFinalizada(conversa({ last_message_at: instante, finalizada_em: instante }))).toBe(true);
  });

  it("reabrir devolve a conversa para a fila, e nao para as finalizadas", () => {
    const reaberta = conversa({
      last_message_at: "2026-08-31T18:00:00Z",
      finalizada_em: "2026-08-31T10:00:00Z",
      ultima_mensagem_de: "customer",
    });
    expect(estadoDaConversa(reaberta)).toBe("esperando");
  });
});

describe("urgencia da espera", () => {
  const agora = new Date("2026-08-31T12:00:00Z");
  const esperandoDesde = (iso: string) => conversa({ ultima_mensagem_de: "customer", last_message_at: iso });

  it("resposta rapida nao acende cor nenhuma", () => {
    expect(urgenciaDaEspera(esperandoDesde("2026-08-31T11:00:00Z"), agora)).toBe("normal");
  });

  it("meia jornada sem resposta pede atencao", () => {
    expect(urgenciaDaEspera(esperandoDesde("2026-08-31T06:00:00Z"), agora)).toBe("atencao");
  });

  // A conversa real da Paola: "Ola" em 20/08, sem resposta ate 31/08.
  it("um dia inteiro sem resposta e urgente", () => {
    expect(urgenciaDaEspera(esperandoDesde("2026-08-20T15:59:00Z"), agora)).toBe("urgente");
  });

  // Pintar tudo de vermelho treina a equipe a ignorar a cor: se as dez linhas
  // da tela sao vermelhas, nenhuma e. Quem nao espera nao tem urgencia.
  it("quem nao esta esperando nao tem urgencia", () => {
    expect(urgenciaDaEspera(conversa({ ultima_mensagem_de: "admin" }), agora)).toBeNull();
    expect(urgenciaDaEspera(conversa({ last_message_preview: null }), agora)).toBeNull();
    expect(horasEsperando(conversa({ ultima_mensagem_de: "admin" }), agora)).toBeNull();
  });

  it("relogio adiantado do cliente nao vira espera negativa", () => {
    expect(horasEsperando(esperandoDesde("2026-08-31T20:00:00Z"), agora)).toBe(0);
  });
});

describe("duracaoCurta", () => {
  it("cabe na linha da lista", () => {
    expect(duracaoCurta(0.75)).toBe("45min");
    expect(duracaoCurta(6)).toBe("6h");
    expect(duracaoCurta(23.9)).toBe("23h");
    expect(duracaoCurta(24)).toBe("1d");
    expect(duracaoCurta(268)).toBe("11d");
  });

  // Arredondar para baixo daria "0min", que se le como "acabou de chegar".
  it("minuto nenhum ainda mostra 1min", () => {
    expect(duracaoCurta(0.001)).toBe("1min");
  });
});
