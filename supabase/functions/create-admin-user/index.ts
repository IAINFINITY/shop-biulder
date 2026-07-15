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

  let body: { email?: string; password?: string; displayName?: string; role?: string };

  try {
    body = await req.json();
  } catch {
    return reply({ error: "Corpo da requisicao invalido" }, 400);
  }

  const { email, password, displayName, role } = body;

  if (!email || !password) return reply({ error: "Email e senha sao obrigatorios" }, 400);
  if (password.length < 8) return reply({ error: "A senha deve ter no minimo 8 caracteres" }, 400);
  if (password.length > 64) return reply({ error: "A senha deve ter no maximo 64 caracteres" }, 400);
  if (!/[A-Z]/.test(password)) return reply({ error: "A senha deve conter pelo menos uma letra maiuscula" }, 400);
  if (!/[a-z]/.test(password)) return reply({ error: "A senha deve conter pelo menos uma letra minuscula" }, 400);
  if (!/\d/.test(password)) return reply({ error: "A senha deve conter pelo menos um numero" }, 400);
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return reply({ error: "A senha deve conter pelo menos um caractere especial" }, 400);

  const normalizedRole = role ?? "admin";

  const { data: authData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: displayName || email.split("@")[0] },
  });

  if (createErr) {
    const dup = String(createErr.message ?? "").toLowerCase().includes("already");
    return reply({ error: dup ? "Este email ja esta em uso" : createErr.message }, 400);
  }

  if (!authData?.user?.id) return reply({ error: "Falha ao criar usuario no Auth" }, 500);

  const userId = authData.user.id;

  const { error: roleErr } = await supabaseAdmin
    .from("user_roles")
    .insert({ user_id: userId, role: normalizedRole });

  if (roleErr) {
    await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
    return reply({ error: roleErr.message }, 500);
  }

  await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "user" }).catch(() => {});

  if (normalizedRole !== "user") {
    await supabaseAdmin.from("admin_users").insert({
      user_id: userId,
      display_name: displayName || "",
      is_active: true,
    }).catch(() => {});
  }

  return reply({ message: "Usuario criado com sucesso", user: { id: userId, email, role: normalizedRole } }, 201);
});
