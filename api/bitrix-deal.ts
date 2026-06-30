import type { VercelRequest, VercelResponse } from "@vercel/node";

const BITRIX_WEBHOOK_BASE_URL = process.env.BITRIX_WEBHOOK_BASE_URL || "";
const BITRIX_PIPELINE_ID = process.env.BITRIX_PIPELINE_ID || "";
const BITRIX_STAGE_ID = process.env.BITRIX_STAGE_ID || "";
const BITRIX_RESPONSIBLE_ID = process.env.BITRIX_RESPONSIBLE_ID || "";
const BITRIX_CURRENCY_ID = process.env.BITRIX_CURRENCY_ID || "BRL";

type OrderItemInput = {
  name: string;
  product_code: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

type BitrixOrderBody = {
  customer_name: string;
  customer_company: string;
  customer_cnpj: string;
  customer_phone: string;
  customer_email: string;
  address: {
    cep: string;
    street: string;
    number: string;
    complement: string;
    neighborhood: string;
    city: string;
    state: string;
  };
  items: OrderItemInput[];
  total_amount: number;
  source: string;
  note: string;
};

function normalizeWebhookBase(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, "");
  return trimmed.replace(/\/profile\.json$/i, "");
}

function buildMethodUrl(method: string): string {
  return `${normalizeWebhookBase(BITRIX_WEBHOOK_BASE_URL)}/${method}.json`;
}

async function callBitrix<T>(method: string, payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(buildMethodUrl(method), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => null)) as
    | { result: T; error: string; error_description: string }
    | null;

  if (!data) throw new Error(`Bitrix empty response (${response.status})`);
  if (!response.ok || data.error) {
    const description = data.error_description || data.error || `Bitrix error (${response.status})`;
    throw new Error(description);
  }

  return data.result as T;
}

function buildDealComments(body: BitrixOrderBody): string {
  const lines = [
    `Cliente: ${body.customer_name}`,
    `Empresa: ${body.customer_company}`,
    `CNPJ: ${body.customer_cnpj}`,
  ];

  if (body.customer_phone) lines.push(`Telefone: ${body.customer_phone}`);
  if (body.customer_email) lines.push(`E-mail: ${body.customer_email}`);

  if (body.address) {
    lines.push(
      `Endereco: ${body.address.street || ""}, ${body.address.number || ""} - ${body.address.neighborhood || ""} - ${body.address.city || ""}/${body.address.state || ""} - CEP ${body.address.cep || ""}`,
    );
    if (body.address.complement) {
      lines.push(`Complemento: ${body.address.complement}`);
    }
  }

  if (body.note.trim()) {
    lines.push("");
    lines.push(body.note.trim());
  }

  lines.push("");
  lines.push("Itens:");
  for (const item of body.items) {
    lines.push(`- ${item.name} x${item.quantity} @ ${item.unit_price}`);
  }

  return lines.join("\n");
}

function buildProductRows(items: OrderItemInput[]) {
  return items.map((item, index) => ({
    PRODUCT_NAME: item.name,
    PRICE: Number(item.unit_price) || 0,
    QUANTITY: Number(item.quantity) || 1,
    SORT: (index + 1) * 100,
    CUSTOM_PRICE: "Y",
    TAX_INCLUDED: "Y",
  }));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!BITRIX_WEBHOOK_BASE_URL) {
    return res.status(500).json({ error: "Bitrix webhook not configured on server" });
  }

  const body = req.body as BitrixOrderBody;

  if (!body.customer_name || !body.customer_company || !body.customer_cnpj || !body.items.length) {
    return res.status(400).json({
      error: "Missing required fields: customer_name, customer_company, customer_cnpj, items",
    });
  }

  try {
    const dealFields: Record<string, unknown> = {
      TITLE: `Pedido Clinic+ - ${body.customer_company || body.customer_name}`,
      CURRENCY_ID: BITRIX_CURRENCY_ID,
      COMMENTS: buildDealComments(body),
    };

    const pipelineId = Number(BITRIX_PIPELINE_ID);
    const stageId = BITRIX_STAGE_ID.trim();
    const responsibleId = Number(BITRIX_RESPONSIBLE_ID);

    if (Number.isFinite(pipelineId) && pipelineId > 0) {
      dealFields.CATEGORY_ID = Math.trunc(pipelineId);
    }

    if (stageId) {
      dealFields.STAGE_ID = stageId;
    }

    if (Number.isFinite(responsibleId) && responsibleId > 0) {
      dealFields.ASSIGNED_BY_ID = Math.trunc(responsibleId);
    }

    const dealId = await callBitrix<number>("crm.deal.add", {
      fields: dealFields,
      params: {
        REGISTER_SONET_EVENT: "Y",
      },
    });

    const productRows = buildProductRows(body.items);
    await callBitrix<number>("crm.deal.productrows.set", {
      id: dealId,
      rows: productRows,
    });

    return res.status(200).json({
      success: true,
      deal_id: dealId,
      product_rows: productRows.length,
    });
  } catch (error) {
    console.error("Bitrix deal integration error:", error);
    return res.status(500).json({
      error: "Bitrix deal integration failed",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
