import { formatCep, type AddressFormData } from "@/lib/address";
import { onlyDigits } from "@/lib/brazilianIds";

/**
 * O endereço cadastral da empresa, vindo da Receita pelo CNPJ.
 *
 * ## Por que existe
 *
 * O projeto tratava "endereço da empresa" e "endereço de entrega" como a mesma
 * coisa, e não são. A conta da ECOZ mostra a diferença de forma limpa:
 *
 * - Receita:  TRES PONTES, S/N · INTERIOR · Xanxerê/SC
 * - Entrega:  Rua Visconde de Cairu, 15 · Vista Alegre · Xanxerê/SC
 *
 * Uma é onde a empresa está registrada; a outra é onde a pessoa quer receber a
 * encomenda. Preencher a primeira com a segunda deixa a ficha cadastral errada,
 * e é a ficha que o painel do admin mostra.
 *
 * ## Por que `cnpj.ws`, e não a BrasilAPI
 *
 * A validação do CNPJ no cadastro usa a BrasilAPI, e o primeiro desenho daqui
 * reaproveitava a mesma fonte. Comparando as duas contra as contas reais, a
 * diferença é sistemática e importa:
 *
 * | | BrasilAPI | cnpj.ws |
 * |---|---|---|
 * | tipo do logradouro | `DO CONTORNO` | `AVENIDA DO CONTORNO` |
 * | acentuação | `FOZ DO IGUACU` | `Foz do Iguaçu` |
 * | registros sem rua | 1 em 8 da amostra | preenchido |
 *
 * A BrasilAPI devolve `logradouro` **sem o tipo**, e "DO CONTORNO" sozinho não
 * é um endereço que alguém consiga usar. A `cnpj.ws` traz o tipo num campo
 * separado, que aqui é recolado na frente do nome.
 *
 * ## Sem fonte reserva, de propósito
 *
 * Seria fácil cair na BrasilAPI quando a `cnpj.ws` recusar por limite de
 * requisições. Não fazemos: gravar um endereço pior de forma **permanente** é
 * pior do que não gravar nada nesta sessão e tentar de novo na próxima. O campo
 * vazio se conserta sozinho; o campo preenchido errado, não.
 */

/** O recorte da resposta da `cnpj.ws` que interessa. Verificado contra a API. */
export type RespostaDeCnpj = {
  /** `simples.mei` vem como "Sim"/"Nao" — texto, nao booleano. */
  simples?: { mei?: string | null } | null;
  estabelecimento?: {
    tipo_logradouro?: string | null;
    logradouro?: string | null;
    numero?: string | null;
    complemento?: string | null;
    bairro?: string | null;
    cep?: string | null;
    cidade?: { nome?: string | null; ibge_id?: number | string | null } | null;
    estado?: { sigla?: string | null } | null;
  } | null;
};

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

/**
 * Converte a resposta da `cnpj.ws` no formato de endereço do projeto.
 *
 * Devolve `null` quando não há endereço utilizável. O critério é o **CEP**: sem
 * ele o endereço não serve para nada aqui — não dá para conferir nem para
 * calcular frete, e gravar um pedaço solto faria a ficha parecer preenchida sem
 * estar.
 */
export function mapearEnderecoDaReceita(resposta: RespostaDeCnpj | null | undefined): AddressFormData | null {
  const est = resposta?.estabelecimento;
  if (!est) return null;

  const cep = onlyDigits(texto(est.cep));
  if (cep.length !== 8) return null;

  // "AVENIDA" + "DO CONTORNO" = "AVENIDA DO CONTORNO". O tipo vem separado, e
  // sozinho o nome não identifica a rua. `filter(Boolean)` porque um dos dois
  // pode faltar — e "AVENIDA " com espaço sobrando ficaria feio na ficha.
  const rua = [texto(est.tipo_logradouro), texto(est.logradouro)].filter(Boolean).join(" ");

  const ibgeBruto = est.cidade?.ibge_id;
  const ibge =
    typeof ibgeBruto === "number" && Number.isFinite(ibgeBruto)
      ? String(ibgeBruto)
      : onlyDigits(texto(ibgeBruto));

  return {
    cep: formatCep(cep),
    street: rua,
    number: texto(est.numero),
    complement: texto(est.complemento),
    neighborhood: texto(est.bairro),
    city: texto(est.cidade?.nome),
    state: texto(est.estado?.sigla).toUpperCase().slice(0, 2),
    ibge,
  };
}

/**
 * Optante pelo MEI, segundo a Receita.
 *
 * Devolve `null` quando a resposta nao traz o bloco — e `null` **nao e**
 * `false`: um significa "nao sabemos", o outro "sabemos que nao". A tela nao
 * mostra selo em nenhum dos dois, mas guardar a diferenca evita afirmar o que
 * nao foi consultado.
 *
 * Nao da para deduzir isto do nome da empresa. Medido nos tres Empresarios
 * Individuais do cadastro: dois sao MEI, um nao e, e os tres tem exatamente o
 * mesmo formato de razao social.
 */
export function lerMeiDaReceita(resposta: RespostaDeCnpj | null | undefined): boolean | null {
  const bruto = resposta?.simples?.mei;
  if (typeof bruto !== "string") return null;
  const valor = bruto.trim().toLowerCase();
  if (valor === "sim") return true;
  if (valor === "nao" || valor === "não") return false;
  return null;
}

/**
 * Busca o endereço cadastral de um CNPJ.
 *
 * Devolve `null` em qualquer falha — CNPJ inexistente, rede fora, ou limite de
 * requisições. **Falhar aqui não pode quebrar nada**: isto enriquece uma ficha,
 * não autoriza nem bloqueia ninguém.
 *
 * O limite é apertado e foi medido: as consultas em sequência só passam com
 * cerca de vinte segundos entre elas. Por isso o preenchimento acontece uma
 * conta por vez, quando a pessoa abre a própria página — e nunca em lote.
 */
export type DadosDaReceita = {
  endereco: AddressFormData | null;
  /** `null` = a resposta nao disse; ver `lerMeiDaReceita`. */
  ehMei: boolean | null;
};

export async function buscarDadosDaReceita(cnpj: string): Promise<DadosDaReceita | null> {
  const digitos = onlyDigits(cnpj);
  if (digitos.length !== 14) return null;

  try {
    const resposta = await fetch(`https://publica.cnpj.ws/cnpj/${digitos}`);
    if (!resposta.ok) return null;
    const dados = (await resposta.json()) as RespostaDeCnpj;
    // Endereco e MEI saem da **mesma** resposta. Buscar em duas chamadas
    // dobraria o consumo de uma API cujo limite ja e apertado, para trazer
    // dados que vieram juntos.
    return { endereco: mapearEnderecoDaReceita(dados), ehMei: lerMeiDaReceita(dados) };
  } catch {
    return null;
  }
}
