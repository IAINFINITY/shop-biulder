/**
 * De quem é o pedido — a mesma regra que a RLS aplica no banco.
 *
 * ## Por que existe
 *
 * Em 02/09/2026 uma funcionária abriu "Meus pedidos" e viu o pedido de outra
 * funcionária. A causa: os **97** perfis de funcionário compartilham
 * `linked_company_cnpj` — o CNPJ da própria Clinic+, porque é a empresa quem
 * fatura a compra deles — e a regra de visibilidade casava por CNPJ.
 *
 * Para um cliente B2B, casar por CNPJ é o comportamento desejado: várias
 * pessoas da mesma empresa acompanham os pedidos da empresa. Para o
 * funcionário, a empresa não é o comprador, é só quem fatura.
 *
 * ## ⚠️ Esta função não protege nada
 *
 * Quem protege é a policy `Clinic B2B customers can view own orders`, na
 * migration `20260902120000`. O navegador nunca é a fronteira: o banco decide o
 * que sai.
 *
 * Ela existe porque a tela **também** filtra — a consulta traz o que a RLS
 * deixa passar e a tela recorta o que interessa àquela seção. Enquanto as duas
 * regras estavam escritas em lugares diferentes, com palavras diferentes, elas
 * podiam divergir; e o jeito de descobrir era um funcionário abrir a conta.
 *
 * Aqui a regra é uma frase só, com teste. Se a do banco mudar, esta tem de
 * mudar junto — e o teste ao lado diz o que ela promete.
 */

/** Só os dígitos. CNPJ chega com e sem pontuação, do cadastro e do pedido. */
function digitos(valor: string | null | undefined): string {
  return (valor ?? "").replace(/\D/g, "");
}

export type PerfilParaVisibilidade = {
  cnpj?: string | null;
  linked_company_cnpj?: string | null;
  customer_type?: string | null;
};

export type PedidoParaVisibilidade = {
  customer_cnpj?: string | null;
  user_id?: string | null;
};

/**
 * O tipo de conta cuja empresa **fatura** a compra sem **ser** a compradora.
 *
 * É o único caso em que o vínculo com a empresa não deve dar acesso aos
 * pedidos dela. Lista, e não booleano, porque um dia pode haver outro — e o
 * nome diz por que o caso existe.
 */
const COMPRA_EM_NOME_PROPRIO = ["funcionario"];

export function pedidoEhVisivelParaOTitular(
  pedido: PedidoParaVisibilidade,
  perfil: PerfilParaVisibilidade | null | undefined,
  userId: string | null | undefined,
): boolean {
  if (!perfil) return false;

  // O dono, quando o pedido sabe quem é. Vale para todo tipo de conta.
  if (pedido.user_id && userId && pedido.user_id === userId) return true;

  // ⚠️ Funcionário não enxerga por CNPJ: o do pedido dele é o da Clinic+,
  // compartilhado com todos os colegas. Ele vê o que é dele pela linha acima.
  const tipo = (perfil.customer_type ?? "").trim().toLowerCase();
  if (COMPRA_EM_NOME_PROPRIO.includes(tipo)) return false;

  const doPedido = digitos(pedido.customer_cnpj);
  if (!doPedido) return false;

  return doPedido === digitos(perfil.cnpj) || doPedido === digitos(perfil.linked_company_cnpj);
}

/** Os pedidos que esta pessoa pode ver, na ordem em que vieram. */
export function pedidosDoTitular<T extends PedidoParaVisibilidade>(
  pedidos: readonly T[],
  perfil: PerfilParaVisibilidade | null | undefined,
  userId: string | null | undefined,
): T[] {
  return pedidos.filter((pedido) => pedidoEhVisivelParaOTitular(pedido, perfil, userId));
}
