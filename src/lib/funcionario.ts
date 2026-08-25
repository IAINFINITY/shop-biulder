// Quem e funcionario, e o que isso muda.
//
// Este modulo e importado pelo bundle do navegador **e** por `api/proxis-order.ts`,
// entao ele nao importa nada: as rotas em `api/` resolvem por caminho relativo,
// sem o alias `@/`. Mesma regra de `proxisOrderStatus.ts`.

/** O `customer_type` do funcionario. Ja existia em `pricing.ts`, sem ninguem usando. */
export const TIPO_FUNCIONARIO = "funcionario";

/** O recorte do perfil que basta para decidir. */
export type PerfilDeCompra = {
  customer_type?: string | null;
  linked_company_cnpj?: string | null;
};

/**
 * E funcionario?
 *
 * ## Por que dois criterios, e nao so o tipo
 *
 * `customer_type = 'funcionario'` e a resposta certa e e o que a migration de
 * 25/08/2026 gravou nos 96 perfis. Mas `linked_company_cnpj` continua no `or`
 * porque ele e preenchido **antes**: a funcao de borda que cria o funcionario
 * grava o vinculo com a Clinic+ na criacao do perfil, e a sincronizacao com o
 * Proxis roda em seguida, no mesmo instante. Nessa janela o tipo ainda pode nao
 * ter sido acertado.
 *
 * A assimetria e proposital. Errar para "e funcionario" custa um pedido que fica
 * na plataforma em vez de ir ao ERP — visivel, e corrigido a mao. Errar para
 * "nao e" manda ao Proxis um pedido com preco de funcionario carimbado com a
 * tabela 8728, que e exatamente o descasamento que a decisao de 25/08 existe
 * para evitar. Nenhum perfil fora dos 96 tem `linked_company_cnpj`, entao o
 * criterio largo nao pega ninguem por engano hoje.
 */
export function ehFuncionario(perfil: PerfilDeCompra | null | undefined): boolean {
  if (!perfil) return false;

  const tipo = typeof perfil.customer_type === "string" ? perfil.customer_type.trim().toLowerCase() : "";
  if (tipo === TIPO_FUNCIONARIO) return true;

  const vinculo = typeof perfil.linked_company_cnpj === "string" ? perfil.linked_company_cnpj.trim() : "";
  return vinculo.length > 0;
}

/**
 * O motivo, em uma frase, para quem le a tela.
 *
 * Fica aqui e nao na tela porque o painel, o checkout e o e-mail de confirmacao
 * dizem a mesma coisa — e ja aconteceu de tres telas explicarem a mesma regra de
 * tres jeitos diferentes.
 */
export const AVISO_PEDIDO_DE_FUNCIONARIO =
  "Pedido de funcionário: preço da tabela Clinic 2026 Funcionários. Não é enviado ao Proxis.";
