import { onlyDigits } from "./brazilianIds.js";

/**
 * O nome da empresa quando a Receita o gerou a partir do CNPJ.
 *
 * ## O que se vê
 *
 * Empresário Individual não escolhe razão social: a Receita monta uma, colando
 * a **raiz do CNPJ** na frente do nome da pessoa.
 *
 *     26.041.551 PATRICIA GUEDES MAZUI PIASSUM
 *     54.626.438 MARCIO DIAS
 *     66.121.553 JOSE FRANCISCO DE ARAUJO NETO
 *
 * Como o nome vem da API e é exibido em destaque, esses clientes aparecem com
 * um número na frente do nome — foi a reclamação que originou este módulo.
 *
 * ## O que este arquivo NÃO faz
 *
 * Ele **não diz se o cliente é MEI**. Medido contra a Receita nos três casos
 * reais acima: dois são MEI, um não é. Todo MEI é Empresário Individual, mas
 * nem todo Empresário Individual é MEI, e os dois têm exatamente o mesmo
 * formato de razão social.
 *
 * Marcar os três como "MEI" colocaria um rótulo errado na tela de um cliente
 * real. O selo de MEI sai de `is_mei`, preenchido a partir da Receita; aqui só
 * mora a limpeza do nome, que é segura para todos.
 */

/**
 * A raiz do CNPJ formatada, do jeito que a Receita escreve: `26.041.551`.
 */
function raizFormatada(cnpj: string): string | null {
  const digitos = onlyDigits(cnpj);
  if (digitos.length !== 14) return null;
  return `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}.${digitos.slice(5, 8)}`;
}

/**
 * O nome começa com a raiz do **próprio** CNPJ deste cliente?
 *
 * A conferência contra o CNPJ é o que torna isto confiável. Reconhecer só o
 * formato (`\d\d\.\d\d\d\.\d\d\d`) marcaria qualquer empresa que por acaso
 * comece com números parecidos; exigindo que sejam os dígitos daquele cliente,
 * um falso positivo exigiria a Receita ter gerado justamente aquele texto.
 */
export function nomeComecaComCnpj(company: string | null | undefined, cnpj: string | null | undefined): boolean {
  const raiz = raizFormatada(String(cnpj ?? ""));
  if (!raiz) return false;

  const nome = String(company ?? "").trim();
  if (!nome.startsWith(raiz)) return false;

  // Precisa sobrar nome depois do número. "26.041.551" sozinho não é nome de
  // ninguém, e devolver string vazia deixaria a tela sem nada para mostrar.
  return nome.slice(raiz.length).trim().length > 0;
}

/**
 * O nome sem a raiz do CNPJ na frente.
 *
 * Devolve o nome como veio quando não há o que tirar — quem chama não precisa
 * saber se o caso se aplica.
 *
 * O CNPJ não se perde: ele já aparece no próprio cadastro, em campo próprio e
 * completo (com filial e dígitos), enquanto aqui só havia a raiz repetida.
 */
export function nomeSemCnpj(company: string | null | undefined, cnpj: string | null | undefined): string {
  const nome = String(company ?? "").trim();
  if (!nomeComecaComCnpj(nome, cnpj)) return nome;

  const raiz = raizFormatada(String(cnpj ?? ""))!;
  return nome.slice(raiz.length).trim();
}
