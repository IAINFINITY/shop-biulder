import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = new Headers({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
});

export default {
  async fetch(req: Request): Promise<Response> {
    try {
      if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
      }
      if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
          status: 405,
          headers: { "Content-Type": "application/json", ...Object.fromEntries(corsHeaders) },
        });
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      if (!supabaseUrl || !supabaseKey) {
        return new Response(JSON.stringify({ error: "Server config error" }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...Object.fromEntries(corsHeaders) },
        });
      }

      const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
      const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
      if (userErr || !userData?.user) {
        return new Response(JSON.stringify({ error: "Não autenticado" }), {
          status: 401,
          headers: { "Content-Type": "application/json", ...Object.fromEntries(corsHeaders) },
        });
      }

      const callerUserId = userData.user.id;
      const { data: hasSuper } = await supabaseAdmin.rpc("has_role", {
        _user_id: callerUserId,
        _role: "superadmin",
      });
      if (!hasSuper) {
        return new Response(JSON.stringify({ error: "Acesso negado" }), {
          status: 403,
          headers: { "Content-Type": "application/json", ...Object.fromEntries(corsHeaders) },
        });
      }

      const body = await req.json();
      const { email, password, displayName, role, permissions } = body as {
        email?: string; password?: string; displayName?: string; role?: string; permissions?: Record<string, boolean>;
      };

      if (!email || !password) {
        return new Response(JSON.stringify({ error: "Email e senha são obrigatórios" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...Object.fromEntries(corsHeaders) },
        });
      }

      /**
       * Política de senha do servidor.
       *
       * Antes exigia maiúscula, minúscula, dígito e caractere especial. São as
       * "regras arbitrárias de composição" que a §10 do padrão de autenticação
       * proíbe, e que já tinham saído de `src/lib/senha.ts` — mas continuavam
       * valendo aqui, no servidor, que é onde a recusa realmente acontece.
       *
       * O que fica é o que não depende de lista nem de rede: comprimento mínimo
       * e o teto de 72 bytes do bcrypt. A verificação completa — senha comum,
       * termo do contexto, derivada do e-mail e base de vazamentos — roda no
       * cliente, em `validarSenha`.
       *
       * **Valores repetidos de propósito.** Edge function roda em Deno, sem o
       * bundler do front, e não alcança `src/lib`. Se `MIN_SEM_MFA` ou
       * `MAX_BYTES` mudarem lá, mudam aqui.
       */
      const MIN_CARACTERES = 10;
      const MAX_BYTES = 72;
      const tamanho = [...password].length;
      const bytes = new TextEncoder().encode(password).length;

      if (tamanho < MIN_CARACTERES) {
        return new Response(
          JSON.stringify({ error: `A senha precisa de pelo menos ${MIN_CARACTERES} caracteres.` }),
          { status: 400, headers: { "Content-Type": "application/json", ...Object.fromEntries(corsHeaders) } },
        );
      }

      if (bytes > MAX_BYTES) {
        return new Response(
          JSON.stringify({ error: `A senha passou do limite de ${MAX_BYTES} bytes. Use uma um pouco mais curta.` }),
          { status: 400, headers: { "Content-Type": "application/json", ...Object.fromEntries(corsHeaders) } },
        );
      }

      const normalizedRole = role ?? "admin";

      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: displayName || email.split("@")[0] },
      });

      if (createErr) {
        const dup = String(createErr.message).toLowerCase().includes("already");
        return new Response(JSON.stringify({
          error: dup ? "Este e-mail já está em uso" : createErr.message,
        }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...Object.fromEntries(corsHeaders) },
        });
      }

      if (!created?.user?.id) {
        return new Response(JSON.stringify({ error: "Falha ao criar usuário no Auth" }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...Object.fromEntries(corsHeaders) },
        });
      }

      const userId = created.user.id;

      const { error: roleErr } = await supabaseAdmin
        .from("clinic+b2b_user_roles")
        .insert({ user_id: userId, role: normalizedRole });

      if (roleErr) {
        console.error("Failed to insert admin role:", roleErr.message);
        const { error: rollbackErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (rollbackErr) console.error("Failed to rollback user deletion:", rollbackErr.message);
        return new Response(JSON.stringify({ error: roleErr.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...Object.fromEntries(corsHeaders) },
        });
      }

      const { error: userRoleErr } = await supabaseAdmin.from("clinic+b2b_user_roles")
        .insert({ user_id: userId, role: "user" });
      if (userRoleErr) console.error("Failed to insert user role:", userRoleErr.message);

      if (normalizedRole !== "user") {
        const { error: adminUsersErr } = await supabaseAdmin.from("clinic+b2b_admin_users")
          .insert({ user_id: userId, display_name: displayName || "", is_active: true, permissions: permissions ?? null });
        if (adminUsersErr) console.error("Failed to insert admin_users:", adminUsersErr.message);
      }

      return new Response(JSON.stringify({
        message: "Usuário criado com sucesso",
        user: { id: userId, email, role: normalizedRole },
      }), {
        status: 201,
        headers: { "Content-Type": "application/json", ...Object.fromEntries(corsHeaders) },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Unhandled error in create-admin-user:", msg);
      return new Response(JSON.stringify({ error: msg }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...Object.fromEntries(corsHeaders) },
      });
    }
  },
};
