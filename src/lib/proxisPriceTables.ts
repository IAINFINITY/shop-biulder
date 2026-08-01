/**
 * Leitura das tabelas de preco do Proxis.
 *
 * O ProManager expoe `ObterTabelasPreco`, que devolve cada tabela com os itens
 * dentro: `tpr_id` e `tpr_descricao` no cabecalho, e em `tabelapreco[]` o
 * `ite_numero` (codigo do produto) com o `tit_preco`.
 *
 * Existe porque a tabela `customer_price_overrides` estava sendo alimentada por
 * fora, e mal: em 31/07/2026 a tabela 8728 tinha 143 dos 156 itens com preco
 * zero, enquanto a mesma tabela no Proxis tinha 165 itens e **nenhum** zero. A
 * 8729 nem chegou a ser importada, apesar de existir na origem com 170 itens e
 * de haver clientes apontando para ela.
 */

export type ProxisPriceItem = {
  productCode: string;
  price: number;
  description: string;
};

export type ProxisPriceTable = {
  tprId: number;
  description: string;
  active: boolean;
  items: ProxisPriceItem[];
};

function toNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function toCode(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

/**
 * Normaliza uma tabela crua do ProManager.
 *
 * Item sem codigo ou com preco que nao seja positivo fica de fora. Zero, numa
 * tabela de preco, quer dizer "nao precificado aqui" — deixar entrar foi
 * exatamente o que colocou 143 produtos por R$ 0,00 na vitrine.
 */
export function normalizeProxisPriceTable(raw: Record<string, unknown>): ProxisPriceTable | null {
  const tprId = toNumber(raw.tpr_id);
  if (tprId === null || tprId <= 0) return null;

  const rows = Array.isArray(raw.tabelapreco) ? raw.tabelapreco : [];
  const items: ProxisPriceItem[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const productCode = toCode(item.ite_numero);
    const price = toNumber(item.tit_preco);
    if (!productCode || price === null || price <= 0) continue;
    // A mesma tabela pode trazer o produto repetido; vale a ultima linha, que e
    // a mais recente na ordem que o ProManager devolve.
    if (seen.has(productCode)) {
      const index = items.findIndex((existing) => existing.productCode === productCode);
      if (index >= 0) items[index] = { productCode, price, description: String(item.ite_descricao ?? "").trim() };
      continue;
    }
    seen.add(productCode);
    items.push({ productCode, price, description: String(item.ite_descricao ?? "").trim() });
  }

  return {
    tprId: Math.trunc(tprId),
    description: String(raw.tpr_descricao ?? "").trim(),
    active: raw.ativo !== false,
    items,
  };
}

export type FetchPageFn = (start: number, size: number) => Promise<unknown>;

/**
 * Le todas as tabelas, paginando ate a origem parar de devolver.
 *
 * A paginacao e por header no ProManager, entao quem chama injeta a funcao de
 * busca — assim o mesmo codigo serve a rota da Vercel e a script de linha de
 * comando, sem duplicar credencial nem cabecalho.
 */
export async function fetchAllProxisPriceTables(
  fetchPage: FetchPageFn,
  pageSize = 50,
): Promise<ProxisPriceTable[]> {
  const tables: ProxisPriceTable[] = [];

  for (let start = 0; ; start += pageSize) {
    const payload = await fetchPage(start, pageSize);
    const rows = Array.isArray(payload) ? payload : [payload].filter(Boolean);
    if (rows.length === 0) break;

    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const table = normalizeProxisPriceTable(row as Record<string, unknown>);
      if (table) tables.push(table);
    }

    if (rows.length < pageSize) break;
  }

  return tables;
}

export type PriceOverrideRow = {
  customer_type: string;
  proxis_tpr_id: number;
  product_code: string;
  price: number;
  active: boolean;
};

/**
 * Converte a tabela do Proxis nas linhas de `customer_price_overrides`.
 *
 * `knownCodes` limita ao que existe no catalogo: a origem carrega itens que o
 * site nao vende, e guardar preco de produto inexistente so infla a consulta que
 * roda a cada visita.
 */
export function toPriceOverrideRows(
  table: ProxisPriceTable,
  customerType: string,
  knownCodes?: ReadonlySet<string>,
): PriceOverrideRow[] {
  return table.items
    .filter((item) => !knownCodes || knownCodes.has(item.productCode))
    .map((item) => ({
      customer_type: customerType,
      proxis_tpr_id: table.tprId,
      product_code: item.productCode,
      price: Math.round(item.price * 100) / 100,
      active: table.active,
    }));
}
