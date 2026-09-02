/**
 * De que tipo de conta é cada pedido — cliente, lojista, distribuidor, funcionário.
 *
 * ## Por que isto não é uma linha dentro da tela
 *
 * É a terceira vez que o mesmo detalhe engana o código: **a compra do
 * funcionário é gravada com o CNPJ da Clinic+**, porque é a empresa quem
 * fatura. Esse CNPJ não pertence a perfil nenhum — os 97 funcionários têm o
 * próprio CPF no cadastro — então qualquer regra que parta do CNPJ do pedido
 * não acha ninguém.
 *
 * As três vezes:
 *
 * 1. a lista da conta mostrava, a cada funcionário, os pedidos dos outros 96;
 * 2. o painel juntava os 97 num cliente só chamado "Clinic+";
 * 3. a aba por tipo classificava o pedido de funcionário como "Sem cadastro" —
 *    o pedido aparecia na lista, mas nunca sob "Funcionário".
 *
 * Cada uma foi encontrada por alguém usando o sistema. Aqui a regra fica num
 * lugar só, com teste, e o caso do funcionário é o primeiro deles.
 */

import { ehFuncionario, TIPO_FUNCIONARIO } from "@/lib/funcionario";

const digitos = (valor: unknown): string => (typeof valor === "string" ? valor.replace(/\D/g, "") : "");

export type PerfilParaClassificar = {
  user_id?: string | null;
  cnpj?: string | null;
  customer_type?: string | null;
  linked_company_cnpj?: string | null;
};

export type PedidoParaClassificar = {
  user_id?: string | null;
  /** Coluna antiga, anterior a `user_id`. Fica como segundo caminho. */
  customer_user_id?: string | null;
  customer_cnpj?: string | null;
};

/**
 * O índice de tipo por conta, chaveado por `user_id` **e** por CNPJ.
 *
 * Duas chaves porque há dois caminhos: o pedido novo sabe o dono, o antigo só
 * tem o CNPJ.
 */
export function mapaDeTipoPorConta(
  perfis: readonly PerfilParaClassificar[],
  normalizarTipo: (valor: unknown) => string,
): Map<string, string> {
  const mapa = new Map<string, string>();

  for (const perfil of perfis) {
    const tipo = ehFuncionario(perfil) ? TIPO_FUNCIONARIO : normalizarTipo(perfil.customer_type);
    const porUsuario = perfil.user_id?.trim();
    const porCnpj = digitos(perfil.cnpj);

    if (porUsuario) mapa.set(porUsuario, tipo);
    // ⚠️ O CNPJ não desempata funcionário: são 97 contas ligadas ao mesmo CNPJ
    // da Clinic+. Só entra quando ainda não há nada, para não sobrescrever o
    // que veio pelo `user_id`, que é exato.
    if (porCnpj && !mapa.has(porCnpj)) mapa.set(porCnpj, tipo);
  }

  return mapa;
}

/**
 * O tipo da conta que fez o pedido, ou `null` quando não há cadastro.
 *
 * ⚠️ **`user_id` antes do CNPJ.** É a única ordem que classifica o funcionário:
 * pelo CNPJ, o pedido dele cai no CNPJ da Clinic+, que não é de perfil nenhum, e
 * o resultado vira "sem cadastro".
 */
export function tipoDaContaDoPedido(
  pedido: PedidoParaClassificar,
  mapa: ReadonlyMap<string, string>,
): string | null {
  const dono = (pedido.user_id ?? pedido.customer_user_id ?? "").trim();
  if (dono) {
    const porDono = mapa.get(dono);
    if (porDono) return porDono;
  }

  const cnpj = digitos(pedido.customer_cnpj);
  return (cnpj && mapa.get(cnpj)) || null;
}

/** Os conjuntos que dizem quais compradores ainda têm cadastro. */
export type IndiceDeContas = {
  userIdSet: ReadonlySet<string>;
  cnpjSet: ReadonlySet<string>;
  nameSet: ReadonlySet<string>;
  companySet: ReadonlySet<string>;
};

/**
 * O pedido é de alguém que ainda tem cadastro?
 *
 * O painel usa isto para não listar pedido órfão — de conta apagada. É a
 * **quarta** aparição do mesmo detalhe: o pedido de funcionário sai com o CNPJ
 * da Clinic+, que não é de perfil nenhum, e a checagem por CNPJ devolvia
 * `false`. Onze pedidos sumiam da "Operação diária" — dois deles de
 * funcionários.
 *
 * ⚠️ **O dono é consultado primeiro, e é a resposta final quando existe.** Quem
 * tem `user_id` gravado é exatamente quem tem conta; nenhum outro critério
 * acrescenta certeza depois disso.
 */
export function pedidoTemCadastro(
  pedido: PedidoParaClassificar & { customer_name?: string | null; customer_company?: string | null },
  indice: IndiceDeContas,
  normalizarTexto: (valor: string) => string,
): boolean {
  const dono = (pedido.user_id ?? pedido.customer_user_id ?? "").trim();
  if (dono) return indice.userIdSet.has(dono);

  const cnpj = digitos(pedido.customer_cnpj);
  if (cnpj) return indice.cnpjSet.has(cnpj);

  const nome = normalizarTexto(pedido.customer_name ?? "");
  if (nome && indice.nameSet.has(nome)) return true;

  const empresa = normalizarTexto(pedido.customer_company ?? "");
  return empresa ? indice.companySet.has(empresa) : false;
}
