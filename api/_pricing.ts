// Leitura dos precos do banco para as rotas serverless.
//
// A decisao de qual preco vale mora em `src/lib/serverPricing.ts` (pura e
// testavel); aqui fica so a consulta.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AuthContext } from "../src/lib/apiAuth.js";
import { buildServerPriceMap, normalizeProductCode, type PriceRow } from "../src/lib/serverPricing.js";

/** Ver a nota sobre nomes repetidos em `_auth.ts`. */
const PRODUCTS_TABLE = "clinic+b2b_clinic_catalogo_front_b2b";
const OVERRIDES_TABLE = "clinic+b2b_customer_price_overrides";
const DEFAULT_CUSTOMER_TYPE = "cliente";

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "").trim();
const SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

/**
 * Com a flag desligada a rota roda em modo sombra: calcula o preco do servidor,
 * registra as divergencias no log e segue usando o que o navegador mandou.
 *
 * A trava existe porque a regra de preco tem casos de borda (tabela por TPR
 * versus tipo de cliente) e um ERP de producao nao e lugar de descobrir
 * divergencia com pedido errado. Ligar com PRICING_ENFORCE_SERVER_PRICE=1
 * depois de conferir os logs.
 */
export function isServerPriceEnforced(): boolean {
  return (process.env.PRICING_ENFORCE_SERVER_PRICE || "").trim() === "1";
}

function admin(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

/**
 * Precos validos para este cliente, por codigo de produto.
 *
 * A tabela por TPR so entra se tiver alguma linha ativa — e a mesma condicao que
 * o catalogo do site usa (`useCustomerPricing` testa `data.length > 0` sobre a
 * tabela inteira, nao so sobre os itens do carrinho). Filtrar por codigo antes
 * dessa checagem mudaria o preco em casos de borda.
 */
export async function resolveServerPrices(
  codes: readonly string[],
  auth: AuthContext,
): Promise<Map<string, number>> {
  const wanted = [...new Set(codes.map((code) => String(code ?? "").trim()).filter(Boolean))];
  if (wanted.length === 0) return new Map();

  const db = admin();

  const { data: catalog, error: catalogError } = await db
    .from(PRODUCTS_TABLE)
    .select("product_code, price")
    .in("product_code", wanted)
    .eq("active", true);
  if (catalogError) throw new Error(`Falha ao ler precos do catalogo: ${catalogError.message}`);

  const tprId = auth.profile?.proxis_tpr_id ?? null;
  let overrides: PriceRow[] = [];

  if (typeof tprId === "number" && Number.isFinite(tprId) && tprId > 0) {
    const { data, error } = await db
      .from(OVERRIDES_TABLE)
      .select("product_code, price")
      .eq("proxis_tpr_id", Math.trunc(tprId))
      .eq("active", true);
    if (error) throw new Error(`Falha ao ler a tabela de preco ${tprId}: ${error.message}`);
    overrides = (data ?? []) as PriceRow[];
  }

  if (overrides.length === 0) {
    const customerType = (auth.profile?.customer_type || DEFAULT_CUSTOMER_TYPE).trim().toLowerCase();
    const { data, error } = await db
      .from(OVERRIDES_TABLE)
      .select("product_code, price")
      .eq("customer_type", customerType)
      .eq("active", true);
    if (error) throw new Error(`Falha ao ler os precos de ${customerType}: ${error.message}`);
    overrides = (data ?? []) as PriceRow[];
  }

  const wantedCodes = new Set(wanted.map(normalizeProductCode));
  return buildServerPriceMap(
    (catalog ?? []) as PriceRow[],
    overrides.filter((row) => wantedCodes.has(normalizeProductCode(row.product_code))),
  );
}
