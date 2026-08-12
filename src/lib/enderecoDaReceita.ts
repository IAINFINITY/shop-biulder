import { formatCep, type AddressFormData } from "@/lib/address";
import { onlyDigits } from "@/lib/brazilianIds";

/**
 * O endereço cadastral da empresa, vindo da Receita pelo CNPJ.
 *
 * ## Por que isso existe
 *
 * O projeto tratava "endereço da empresa" e "endereço de entrega" como a mesma
 * coisa, e não são. A conta da ECOZ mostra a diferença de forma limpa:
 *
 * - Receita:  TRES PONTES, S/N, LINHA · INTERIOR · XANXERE/SC
 * - Entrega:  Rua Visconde de Cairu, 15 · Vista Alegre · Xanxerê/SC
 *
 * Uma é onde a empresa está registrada; a outra é onde a pessoa quer receber a
 * encomenda. Preencher a primeira com a segunda — que era o que acontecia —
 * deixa a ficha cadastral errada, e é a ficha que o painel do admin mostra.
 *
 * A consulta ao CNPJ **já é feita** na validação do cadastro; o endereço vinha
 * na resposta e era descartado. Aqui ele é aproveitado.
 */

/** O recorte da resposta da BrasilAPI que interessa. Verificado contra a API. */
export type RespostaDeCnpj = {
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  municipio?: string | null;
  uf?: string | null;
  codigo_municipio_ibge?: number | string | null;
};

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

/**
 * Converte a resposta da Receita no formato de endereço do projeto.
 *
 * Devolve `null` quando não há endereço utilizável. O critério é o **CEP**: sem
 * ele o endereço não serve para nada aqui — não dá para conferir, nem para
 * calcular frete, e gravar um pedaço solto faria a ficha parecer preenchida
 * sem estar.
 *
 * Os textos vão como a Receita entrega, em maiúsculas e sem acento
 * (`XANXERE`, não `Xanxerê`). É feio e é de propósito: o acento não está no
 * dado de origem, e inventá-lo seria transformar registro oficial em chute.
 */
export function mapearEnderecoDaReceita(resposta: RespostaDeCnpj | null | undefined): AddressFormData | null {
  if (!resposta) return null;

  const cep = onlyDigits(texto(resposta.cep));
  if (cep.length !== 8) return null;

  const ibgeBruto = resposta.codigo_municipio_ibge;
  const ibge =
    typeof ibgeBruto === "number" && Number.isFinite(ibgeBruto)
      ? String(ibgeBruto)
      : onlyDigits(texto(ibgeBruto));

  return {
    cep: formatCep(cep),
    street: texto(resposta.logradouro),
    number: texto(resposta.numero),
    complement: texto(resposta.complemento),
    neighborhood: texto(resposta.bairro),
    city: texto(resposta.municipio),
    state: texto(resposta.uf).toUpperCase().slice(0, 2),
    ibge,
  };
}

/**
 * Busca o endereço cadastral de um CNPJ.
 *
 * Devolve `null` em qualquer falha — CNPJ inexistente, rede fora, ou o limite
 * de requisições da BrasilAPI. **Falhar aqui não pode quebrar nada**: isto
 * enriquece uma ficha, não autoriza nem bloqueia ninguém.
 *
 * O limite é real e foi medido: quatro chamadas seguidas da mesma máquina
 * renderam `429` e depois `403`. Por isso o preenchimento acontece uma conta
 * por vez, quando a pessoa abre a própria página — e nunca em lote.
 */
export async function buscarEnderecoDaReceita(cnpj: string): Promise<AddressFormData | null> {
  const digitos = onlyDigits(cnpj);
  if (digitos.length !== 14) return null;

  try {
    const resposta = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digitos}`);
    if (!resposta.ok) return null;
    return mapearEnderecoDaReceita((await resposta.json()) as RespostaDeCnpj);
  } catch {
    return null;
  }
}
