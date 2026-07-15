import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function reply(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseKey) return reply({ error: "Erro de configuracao do servidor" }, 500);

  const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const authHeader = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(authHeader);
  if (authErr || !user) return reply({ error: "Nao autenticado" }, 401);

  const { data: hasRole } = await supabaseAdmin.rpc("has_role", { _user_id: user.id, _role: "superadmin" });
  if (!hasRole) return reply({ error: "Acesso negado" }, 403);

  let body: { userId?: string };

  try {
    body = await req.json();
  } catch {
    return reply({ error: "Corpo da requisicao invalido" }, 400);
  }

  const { userId } = body;

  if (!userId) return reply({ error: "userId e obrigatorio" }, 400);

  const { error: deleteErr } = await supabaseAdmin.auth.admin.deleteUser(userId);

  if (deleteErr) return reply({ error: deleteErr.message }, 500);

  return reply({ message: "Usuario excluido com sucesso" });
});
