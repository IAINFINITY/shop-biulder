// Preco do pedido recalculado no servidor.
//
// O preco que chega no corpo da requisicao e o que o navegador calculou, e o
// navegador e territorio do usuario. Aqui a regra e refeita a partir do banco.
//
// Autocontido de proposito: `src/lib/pricing.ts` tem a mesma regra, mas importa
// pelo alias `@/`, que nao resolve no runtime das funcoes serverless. Se a regra
// de preco mudar la, precisa mudar aqui. O teste
// `serverPricing.test.ts` existe para travar o comportamento nos dois.

// Caminho relativo com `.js`: este arquivo tambem e carregado pelas funcoes
// serverless em `api/`, onde o alias `@/` do Vite nao existe.
import { precoFinalComPromocao } from "./promocao.js";

export type PriceRow = {
  product_code: string | null;
  price: number | string | null;
  /** So o catalogo traz promocao; a tabela de override nao tem essas colunas. */
  promo_percent?: number | string | null;
  promo_starts_at?: string | null;
  promo_ends_at?: string | null;
};

export function normalizeProductCode(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Mapa `codigo -> preco` na mesma ordem de precedencia do catalogo do site:
 * override da tabela do cliente vence o preco base do produto.
 *
 * Preco zero ou negativo e descartado: no catalogo isso significa "sem preco
 * cadastrado", e deixar passar viraria pedido a zero no ERP.
 */
export function buildServerPriceMap(
  catalogRows: readonly PriceRow[],
  overrideRows: readonly PriceRow[],
  agora: Date = new Date(),
): Map<string, number> {
  const prices = new Map<string, number>();

  for (const rows of [catalogRows, overrideRows]) {
    for (const row of rows) {
      const code = normalizeProductCode(row.product_code);
      if (!code) continue;
      const price = Number(row.price);
      if (!Number.isFinite(price) || price <= 0) continue;
      prices.set(code, roundMoney(price));
    }
  }

  // A promocao entra **depois** da precedencia de tabelas, sobre a base que
  // sobrou — igual ao `resolveProductPrice` do navegador.
  //
  // Sem esta camada o servidor recalcularia o preco cheio e acusaria divergencia
  // em todo item em promocao; com `PRICING_ENFORCE_SERVER_PRICE` ligado, o
  // pedido iria ao ERP **sem o desconto** que o cliente viu na tela. E a mesma
  // funcao pura do front, e nao uma segunda implementacao da regra.
  for (const row of catalogRows) {
    const code = normalizeProductCode(row.product_code);
    if (!code) continue;
    const base = prices.get(code);
    if (base === undefined) continue;
    prices.set(code, roundMoney(precoFinalComPromocao(base, {
      promo_percent: row.promo_percent === null || row.promo_percent === undefined
        ? null
        : Number(row.promo_percent),
      promo_starts_at: row.promo_starts_at ?? null,
      promo_ends_at: row.promo_ends_at ?? null,
    }, agora)));
  }

  return prices;
}

export type PriceCheck = {
  code: string;
  name: string;
  client_price: number;
  server_price: number | null;
};

/** Itens em que o preco do navegador nao bate com o do servidor. */
export function diffPrices(checks: readonly PriceCheck[]): PriceCheck[] {
  return checks.filter(
    (check) => check.server_price === null || roundMoney(check.client_price) !== check.server_price,
  );
}

/** Quantidade aceita num item de pedido. */
export function isValidQuantity(value: unknown): boolean {
  const quantity = Number(value);
  return Number.isInteger(quantity) && quantity > 0 && quantity <= 9999;
}
