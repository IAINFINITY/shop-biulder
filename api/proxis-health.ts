import type { VercelRequest, VercelResponse } from "@vercel/node";

const PROXSIS_BASE_URL = process.env.PROXSIS_BASE_URL || "";
const PROXSIS_USER = process.env.PROXSIS_USER || "";
const PROXSIS_PASSWORD = process.env.PROXSIS_PASSWORD || "";
const PROXSIS_FILIAL = process.env.PROXSIS_FILIAL || "5";

function buildAuthHeader(): string {
  return "Basic " + Buffer.from(`${PROXSIS_USER}:${PROXSIS_PASSWORD}`).toString("base64");
}

async function checkProxisDirect(): Promise<{ connected: boolean; error: string | null }> {
  const url = `${PROXSIS_BASE_URL.replace(/\/$/, "")}/"ObterItens"`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: buildAuthHeader(),
    "x-promanager-filial": PROXSIS_FILIAL,
    "X-ProManager-Pagina-Inicio": "0",
    "X-ProManager-Pagina-Quant": "1",
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      method: "GET",
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const text = await res.text();
      return { connected: false, error: `HTTP ${res.status}: ${text.slice(0, 120)}` };
    }

    return { connected: true, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { connected: false, error: message };
  }
}

async function checkProxisViaN8n(): Promise<{ connected: boolean; error: string | null }> {
  const n8nProxy = (process.env.N8N_WEBHOOK_BASE_URL || "").trim();
  if (!n8nProxy) {
    return { connected: false, error: "N8N_WEBHOOK_BASE_URL nao configurado" };
  }

  const auth = buildAuthHeader();
  const proxyUrl = `${n8nProxy.replace(/\/$/, "")}/proxis-proxy`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(proxyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: "ObterItens",
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: auth,
          "x-promanager-filial": PROXSIS_FILIAL,
          "X-ProManager-Pagina-Inicio": "0",
          "X-ProManager-Pagina-Quant": "1",
        },
        body: null,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const text = await res.text();
      return { connected: false, error: `n8n HTTP ${res.status}: ${text.slice(0, 120)}` };
    }

    const result = await res.json();

    if (result?.status && result.status >= 400) {
      return { connected: false, error: `Proxis HTTP ${result.status}` };
    }

    if (result?.error || result?.errorMessage || result?.message) {
      return { connected: false, error: result.error || result.errorMessage || result.message };
    }

    if (result?.body === null && result?.status === 500) {
      return { connected: false, error: "Proxis via n8n retornou erro" };
    }

    return { connected: true, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { connected: false, error: message };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!PROXSIS_BASE_URL || !PROXSIS_USER || !PROXSIS_PASSWORD) {
    return res.status(200).json({ connected: false, error: "Proxsis nao configurado no servidor" });
  }

  const n8nProxy = (process.env.N8N_WEBHOOK_BASE_URL || "").trim();

  const result = n8nProxy ? await checkProxisViaN8n() : await checkProxisDirect();

  return res.status(200).json(result);
}
