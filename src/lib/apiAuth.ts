// Caminho relativo com `.js`: este arquivo tambem e importado pelas funcoes em
// `api/`, que compilam sem o alias `@/`.
import type { Aal } from "./mfa.js";
// Regras de autorizacao das rotas `/api/*`.
//
// Mesma divisao de `proxisOrderStatusStore`: aqui fica so a decisao, sem tocar
// `process.env` nem fazer I/O, porque este arquivo vive em `src/` — escopo do
// bundle do navegador. A leitura de credencial e a chamada ao Supabase ficam em
// `api/_auth.ts`.
//
// Manter a regra separada do I/O e o que permite testa-la: e ela que decide se
// um cliente pode lancar pedido no CNPJ de outro.

export type AuthProfile = {
  cnpj: string | null;
  customer_type: string | null;
  proxis_tpr_id: number | null;
  linked_company_cnpj: string | null;
};

export type AuthContext = {
  userId: string;
  isAdmin: boolean;
  profile: AuthProfile | null;
  /**
   * Garantia de autenticacao do token: `aal1` = um fator, `aal2` = dois.
   *
   * Vem de dentro do JWT assinado, entao nao ha como o cliente inventar. `null`
   * quando o token nao traz a reivindicacao — e `null` nunca satisfaz `aal2`.
   * Ver `src/lib/mfa.ts`.
   */
  aal: Aal;
};

function onlyDigits(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

/** Token do header `Authorization: Bearer <token>`. Vazio quando nao houver. */
export function parseBearerToken(header: unknown): string {
  const raw = String(header ?? "");
  if (!raw.toLowerCase().startsWith("bearer ")) return "";
  return raw.slice(7).trim();
}

/**
 * Se o chamador pode agir em nome deste CNPJ.
 *
 * Admin age por qualquer um — e o reenvio manual de pedido pelo painel e a
 * consulta da ficha do cliente. Cliente age pelo proprio CNPJ ou pelo da empresa
 * vinculada, que e o caso do funcionario comprando pelo CNPJ mestre da Clinic+.
 *
 * Sem essa checagem, autenticar a rota resolveria metade do problema: qualquer
 * usuario logado continuaria consultando a ficha de qualquer CNPJ.
 */
export function canActForCnpj(auth: AuthContext, cnpj: unknown): boolean {
  if (auth.isAdmin) return true;

  const target = onlyDigits(cnpj);
  if (target.length !== 14) return false;

  return [auth.profile?.cnpj, auth.profile?.linked_company_cnpj]
    .map(onlyDigits)
    .filter((value) => value.length === 14)
    .includes(target);
}
