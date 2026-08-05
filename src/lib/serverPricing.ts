// Preco do pedido recalculado no servidor.
//
// O preco que chega no corpo da requisicao e o que o navegador calculou, e o
// navegador e territorio do usuario. Aqui a regra e refeita a partir do banco.
//
// Autocontido de proposito: `src/lib/pricing.ts` tem a mesma regra, mas importa
// pelo alias `@/`, que nao resolve no runtime das funcoes serverless. Se a regra
// de preco mudar la, precisa mudar aqui. O teste
// `serverPricing.test.ts` existe para travar o comportamento nos dois.

export type PriceRow = {
  product_code: string | null;
  price: number | string | null;
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
