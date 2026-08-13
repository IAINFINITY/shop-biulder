/**
 * Por onde as rotas falam com o Proxsys — decidido num lugar so.
 *
 * ## O que estava acontecendo
 *
 * Cinco rotas conversam com o ERP, e cada uma escolhia o caminho por conta
 * propria. Tres delas iam direto; duas passavam por um proxy no n8n. Ninguem
 * decidiu isso — foi o resultado de mexer numa rota e esquecer as outras:
 *
 * | rota | caminho |
 * |---|---|
 * | `proxis-order` | direto — com `let n8nProxy = ""` fixado no codigo |
 * | `proxis-item-check` | direto — nunca teve o proxy |
 * | `proxis-price-tables` | direto — nunca teve o proxy |
 * | `proxis-customer` | n8n |
 * | `proxis-health` | n8n |
 *
 * O estrago disso apareceu quando o workflow do n8n comecou a devolver
 * `500 Workflow execution failed`: o **teste de conexao do painel ficava
 * vermelho enquanto os pedidos saiam normalmente**, porque mediam caminhos
 * diferentes. Um indicador que nao fala sobre o caminho que importa e pior que
 * nenhum — ele manda investigar o lado errado.
 *
 * ## A regra agora
 *
 * O proxy so entra quando alguem **pede explicitamente**, com
 * `PROXSIS_VIA_N8N=1`. Antes bastava `N8N_WEBHOOK_BASE_URL` existir para o
 * comportamento virar — e essa variavel pode estar ali por outro motivo, ou ter
 * sobrado de um teste. Presenca de endereco nao e intencao de uso.
 *
 * E o mesmo formato dos outros interruptores operacionais do projeto
 * (`MFA_ADMIN_OBRIGATORIO`, `PRICING_ENFORCE_SERVER_PRICE`): desligado por
 * padrao, ligado por quem sabe o que esta fazendo.
 */

/** Como a chamada sai daqui. Vai no corpo do teste de conexao, para a tela dizer o que mediu. */
export type CaminhoDoProxis = "direto" | "n8n";

/**
 * O endereco do proxy, ou `null` quando as chamadas devem ir direto.
 *
 * Devolver `null` — e nao string vazia — obriga quem chama a tratar o caso: o
 * `let n8nProxy = ""` de antes se parecia com uma variavel esquecida, e foi
 * preciso um comentario e um `eslint-disable` para explicar que era de
 * proposito.
 */
export function urlDoProxyN8n(): string | null {
  const ligado = (process.env.PROXSIS_VIA_N8N || "").trim();
  if (ligado !== "1" && ligado.toLowerCase() !== "true") return null;

  const base = (process.env.N8N_WEBHOOK_BASE_URL || "").trim();
  if (!base) return null;

  return `${base.replace(/\/$/, "")}/proxis-proxy`;
}

/** O caminho em uso, para relatorio. */
export function caminhoDoProxis(): CaminhoDoProxis {
  return urlDoProxyN8n() ? "n8n" : "direto";
}
