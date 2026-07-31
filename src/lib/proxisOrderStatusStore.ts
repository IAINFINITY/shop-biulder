// Escrita do desfecho da sincronia com o Proxis de volta no pedido.
//
// Roda apenas nas rotas serverless: usa a service role porque o RLS de `orders`
// so permite UPDATE para admin, e quem envia o pedido no checkout e o proprio
// cliente. Deixar essa escrita no navegador tambem perderia o desfecho sempre que
// a aba fosse fechada no meio do envio.
//
// A credencial chega por parametro em vez de ser lida aqui: este arquivo vive em
// `src/`, que e o escopo do bundle do navegador, e nao deve tocar `process.env`.
//
// Nenhuma funcao aqui lanca excecao: registrar o status e importante, mas nunca
// ao ponto de derrubar um pedido que ja foi aceito.

import { isSubmissionKey, type ProxisSyncStatus } from "./proxisOrderStatus.js";

const REQUEST_TIMEOUT_MS = 5000;
const MAX_ERROR_LENGTH = 2000;

export type ProxisSyncCredentials = {
  supabaseUrl: string;
  serviceRoleKey: string;
};

type EnvLike = Record<string, string | undefined>;

/** Le a credencial de escrita do ambiente da rota. Retorna null se faltar algo. */
export function resolveProxisSyncCredentials(env: EnvLike): ProxisSyncCredentials | null {
  const supabaseUrl = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || "").trim().replace(/\/$/, "");
  const serviceRoleKey = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!supabaseUrl || !serviceRoleKey) return null;
  return { supabaseUrl, serviceRoleKey };
}

function truncateError(value: string | null | undefined): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  return text.length > MAX_ERROR_LENGTH ? `${text.slice(0, MAX_ERROR_LENGTH)}...` : text;
}

export type RecordProxisSyncInput = {
  submissionKey: string | null | undefined;
  status: ProxisSyncStatus;
  error?: string | null;
  docPedWeb?: string | null;
};

/**
 * Grava o desfecho da tentativa no pedido correspondente ao `submission_key`.
 * Retorna false (sem lancar) quando falta credencial, a chave e invalida ou o
 * Supabase recusou a escrita.
 */
export async function recordProxisOrderSync(
  credentials: ProxisSyncCredentials | null,
  input: RecordProxisSyncInput,
): Promise<boolean> {
  if (!isSubmissionKey(input.submissionKey)) {
    // Cliente antigo em cache, ou reenvio de pedido anterior a esta mudanca:
    // o envio segue normalmente, apenas sem registro de status.
    return false;
  }

  if (!credentials) {
    console.warn(
      "[proxis-sync] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes: status do pedido nao sera registrado.",
    );
    return false;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${credentials.supabaseUrl}/rest/v1/rpc/record_proxis_order_sync`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        apikey: credentials.serviceRoleKey,
        Authorization: `Bearer ${credentials.serviceRoleKey}`,
      },
      body: JSON.stringify({
        p_submission_key: String(input.submissionKey).trim(),
        p_status: input.status,
        p_error: truncateError(input.error),
        p_doc_ped_web: input.docPedWeb ?? null,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error(`[proxis-sync] Falha ao registrar status (${response.status}):`, detail.slice(0, 500));
      return false;
    }

    return true;
  } catch (error) {
    console.error("[proxis-sync] Erro ao registrar status do pedido:", error);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
