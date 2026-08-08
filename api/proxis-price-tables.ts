import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { requireAuth } from "./_auth.js";
import { aplicarRateLimit } from "./_rateLimit.js";
import { fetchAllProxisPriceTables, toPriceOverrideRows } from "../src/lib/proxisPriceTables.js";

/**
 * Tabelas de preco do Proxis: listar e importar.
 *
 * GET  -> lista as tabelas da origem, com quantos itens cada uma tem e quantos
 *         batem com o catalogo do site.
 * POST -> importa as tabelas pedidas para `customer_price_overrides`.
 *
 * Passou a existir porque a tabela de precos era alimentada por fora, sem
 * conferencia. Em 31/07/2026 a tabela 8728 estava com 143 dos 156 itens em preco
 * zero no nosso banco, contra 165 itens e nenhum zero na origem, e a 8729 nunca
 * tinha sido importada apesar de haver clientes apontando para ela.
 *
 * Roda no servidor porque a credencial do Proxis e a chave de servico do
 * Supabase nao podem chegar ao navegador.
 */

const PROXSIS_BASE_URL = (process.env.PROXSIS_BASE_URL || "").trim();
const PROXSIS_USER = process.env.PROXSIS_USER || "";
const PROXSIS_PASSWORD = process.env.PROXSIS_PASSWORD || "";
const PROXSIS_FILIAL = (process.env.PROXSIS_FILIAL || "5").trim();

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "").trim();
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

const OVERRIDES_TABLE = "clinic+b2b_customer_price_overrides";
const CATALOG_TABLE = "clinic+b2b_clinic_catalogo_front_b2b";
/** Toda tabela do Proxis e de cliente; o tipo separa apenas o fallback geral. */
const CUSTOMER_TYPE = "cliente";

function buildAuthHeader(): string {
  return "Basic " + Buffer.from(`${PROXSIS_USER.trim()}:${PROXSIS_PASSWORD.trim()}`).toString("base64");
}

async function fetchPage(start: number, size: number): Promise<unknown> {
  const url = `${PROXSIS_BASE_URL.replace(/\/$/, "")}/"ObterTabelasPreco"`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: buildAuthHeader(),
      "x-proManager-filial": PROXSIS_FILIAL,
      "X-ProManager-Pagina-Inicio": String(start),
      "X-ProManager-Pagina-Quant": String(size),
    },
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    throw new Error(`Proxis respondeu ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return res.json();
}

function supabaseAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

const toCode = (value: unknown) => String(value ?? "").trim().toUpperCase();

async function loadCatalogCodes(): Promise<Set<string>> {
  const { data, error } = await supabaseAdmin().from(CATALOG_TABLE).select("product_code").eq("active", true);
  if (error) throw new Error(`Falha ao ler o catalogo: ${error.message}`);
  return new Set((data ?? []).map((row) => toCode(row.product_code)).filter(Boolean));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Sincroniza tabela de preço: operação de administração.
  const auth = await requireAuth(req, res, { adminOnly: true });
  if (!auth) return;

  // Limite de uso por conta (§21). Depois do guard de propósito: sem saber quem
  // é, não há dimensão melhor que IP — e a §21 diz que IP isolado não serve como
  // controle principal.
  if (!(await aplicarRateLimit(req, res, "proxis-price-tables", auth.userId))) return;

  if (!PROXSIS_BASE_URL || !PROXSIS_USER || !PROXSIS_PASSWORD) {
    return res.status(500).json({ error: "Integração com o Proxis não configurada." });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: "Credenciais do Supabase ausentes no servidor." });
  }

  try {
    const catalogCodes = await loadCatalogCodes();
    const tables = await fetchAllProxisPriceTables(fetchPage);

    if (req.method === "GET") {
      const supabase = supabaseAdmin();
      const { data: imported } = await supabase.from(OVERRIDES_TABLE).select("proxis_tpr_id, price");
      const importedByTpr = new Map<number, { rows: number; zeros: number }>();
      for (const row of imported ?? []) {
        const tpr = typeof row.proxis_tpr_id === "number" ? row.proxis_tpr_id : null;
        if (tpr === null) continue;
        const entry = importedByTpr.get(tpr) ?? { rows: 0, zeros: 0 };
        entry.rows += 1;
        if (Number(row.price) === 0) entry.zeros += 1;
        importedByTpr.set(tpr, entry);
      }

      // Quais tabelas algum cliente usa de fato: sao as que importam.
      const { data: profiles } = await supabase.from("clinic+b2b_customer_profiles").select("proxis_tpr_id");
      const inUse = new Set(
        (profiles ?? []).map((row) => row.proxis_tpr_id).filter((v): v is number => typeof v === "number"),
      );

      return res.status(200).json({
        tables: tables.map((table) => {
          const matching = table.items.filter((item) => catalogCodes.has(item.productCode));
          const stored = importedByTpr.get(table.tprId) ?? null;
          return {
            tprId: table.tprId,
            description: table.description,
            active: table.active,
            itemsInProxis: table.items.length,
            itemsInCatalog: matching.length,
            /** Produtos do catalogo que esta tabela nao precifica. */
            catalogWithoutPrice: catalogCodes.size - matching.length,
            importedRows: stored?.rows ?? 0,
            importedZeros: stored?.zeros ?? 0,
            usedByCustomers: inUse.has(table.tprId),
          };
        }),
        catalogSize: catalogCodes.size,
      });
    }

    if (req.method === "POST") {
      const body = (typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {}) as {
        tprIds?: unknown;
      };
      const requested = Array.isArray(body.tprIds)
        ? new Set(body.tprIds.map((value) => Number(value)).filter((value) => Number.isFinite(value)))
        : null;

      const selected = requested ? tables.filter((table) => requested.has(table.tprId)) : tables;
      if (selected.length === 0) {
        return res.status(400).json({ error: "Nenhuma tabela válida informada." });
      }

      const supabase = supabaseAdmin();
      const results: { tprId: number; description: string; rows: number; error: string | null }[] = [];

      for (const table of selected) {
        const rows = toPriceOverrideRows(table, CUSTOMER_TYPE, catalogCodes);

        // Troca completa: a tabela do Proxis e a verdade. Atualizar linha a linha
        // deixaria para tras o item que saiu da tabela na origem.
        const { error: deleteError } = await supabase.from(OVERRIDES_TABLE).delete().eq("proxis_tpr_id", table.tprId);
        if (deleteError) {
          results.push({ tprId: table.tprId, description: table.description, rows: 0, error: deleteError.message });
          continue;
        }

        if (rows.length > 0) {
          const { error: insertError } = await supabase.from(OVERRIDES_TABLE).insert(rows);
          if (insertError) {
            results.push({ tprId: table.tprId, description: table.description, rows: 0, error: insertError.message });
            continue;
          }
        }

        results.push({ tprId: table.tprId, description: table.description, rows: rows.length, error: null });
      }

      return res.status(200).json({ results });
    }

    return res.status(405).json({ error: "Método não suportado." });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[proxis-price-tables]", message);
    return res.status(502).json({ error: message });
  }
}
