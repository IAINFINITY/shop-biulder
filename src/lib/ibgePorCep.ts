// `.js` e nao `./brazilianIds`: este modulo e importado por `api/proxis-order.ts`,
// e o runtime serverless resolve o especificador literalmente. Sem a extensao,
// o modulo nao carrega **em producao** — e passa em teste, porque o vitest
// resolve TypeScript. Mesmo motivo do `import type { Aal } from "./mfa.js"` em
// `apiAuth.ts`.
import { onlyDigits } from "./brazilianIds.js";

/**
 * O código IBGE do município, quando o navegador não conseguiu trazê-lo.
 *
 * ## O problema que isto resolve
 *
 * O ERP exige o código IBGE para gravar o pedido. Quem preenche esse campo é a
 * consulta ao ViaCEP, no navegador de quem está comprando — e a pessoa nunca vê
 * o campo, nem teria como saber o número.
 *
 * Quando essa consulta falha, o pedido é criado no site com endereço completo e
 * IBGE vazio. O checkout aceita, porque `assertAddressReady` não pede IBGE; o
 * ERP recusa. O cliente recebe a confirmação, e o pedido nunca entra —
 * descoberto num pedido real, com a mensagem *"Endereço incompleto: preencha
 * CEP, rua, número, bairro, cidade, UF e IBGE"* numa compra em que **todo o
 * resto do endereço estava correto**.
 *
 * A consulta pode falhar por vários motivos, e nenhum deles é culpa de quem
 * compra: a CSP do site chegou a bloquear o ViaCEP, a pessoa pode ter digitado
 * o endereço à mão, ou pode ter usado um endereço salvo antes de o campo
 * existir.
 *
 * ## Por que no servidor
 *
 * O servidor não tem CSP e não depende do que o navegador conseguiu fazer. Ele
 * é o último ponto antes do ERP: resolver aqui conserta o pedido que já estava
 * a caminho de ser recusado, inclusive no reenvio de pedidos antigos.
 */

/** O que o ViaCEP devolve e nos interessa. */
type RespostaViaCep = { ibge?: string | null; erro?: boolean | string };

export type EnderecoParaIbge = {
  cep?: string | null;
  street?: string | null;
  number?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  ibge?: string | null;
};

/**
 * O endereço está completo, e só falta o IBGE?
 *
 * Puro, para poder ser provado. A distinção importa: endereço faltando rua ou
 * cidade é problema de quem preencheu e precisa voltar para a tela. Faltando
 * **apenas** o IBGE, é falha nossa de bastidor — e dá para resolver sem
 * incomodar ninguém.
 */
export function faltaApenasOIbge(endereco: EnderecoParaIbge | null | undefined): boolean {
  if (!endereco) return false;

  const texto = (v: unknown) => String(v ?? "").trim();
  const temTudo =
    onlyDigits(texto(endereco.cep)).length === 8 &&
    Boolean(texto(endereco.street)) &&
    Boolean(texto(endereco.number)) &&
    Boolean(texto(endereco.neighborhood)) &&
    Boolean(texto(endereco.city)) &&
    texto(endereco.state).length === 2;

  return temTudo && onlyDigits(texto(endereco.ibge)).length < 7;
}

/**
 * Busca o IBGE pelo CEP.
 *
 * Devolve `null` em qualquer falha. **Não pode derrubar o pedido**: se não der
 * para completar, o fluxo segue e a recusa acontece como antes — com a
 * mensagem que já existia. Piorar um caminho que já estava ruim não ajuda
 * ninguém.
 */
export async function buscarIbgePorCep(cep: string): Promise<string | null> {
  const digitos = onlyDigits(cep);
  if (digitos.length !== 8) return null;

  try {
    const resposta = await fetch(`https://viacep.com.br/ws/${digitos}/json/`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!resposta.ok) return null;

    const dados = (await resposta.json()) as RespostaViaCep;
    // O ViaCEP responde 200 com `{"erro": true}` para CEP inexistente — checar
    // só o status deixaria passar.
    if (dados.erro) return null;

    const ibge = onlyDigits(String(dados.ibge ?? ""));
    return ibge.length >= 7 ? ibge : null;
  } catch {
    return null;
  }
}
