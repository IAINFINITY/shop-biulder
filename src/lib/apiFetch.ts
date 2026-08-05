import { loadSupabaseClient } from "@/lib/loadSupabaseClient";

/**
 * `fetch` para as rotas `/api/*`, que exigem o access token do Supabase.
 *
 * As rotas falam com o ERP em nome do usuario — criam pedido, criam cadastro de
 * cliente, consultam ficha por CNPJ. Sem o header `Authorization` o servidor
 * responde 401, entao todo acesso a `/api` no front precisa passar por aqui.
 *
 * A falta de sessao nao aborta a chamada: deixamos o servidor responder 401 para
 * que o erro apareça no fluxo normal de tratamento, em vez de virar uma excecao
 * diferente no meio do checkout.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  let token: string | null = null;

  try {
    const supabase = await loadSupabaseClient();
    const { data } = await supabase.auth.getSession();
    token = data.session?.access_token ?? null;
  } catch (error) {
    console.warn("[apiFetch] Falha ao obter a sessão do Supabase:", error);
  }

  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  return fetch(path, { ...init, headers });
}
