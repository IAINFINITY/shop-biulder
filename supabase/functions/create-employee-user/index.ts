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
        return new Response(JSON.stringify({ error: "Nao autenticado" }), {
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
      const { name, phone, email, password, cpf, linkedCompanyCnpj } = body as {
        name?: string; phone?: string; email?: string; password?: string;
        cpf?: string; linkedCompanyCnpj?: string;
      };

      if (!name || !phone || !email || !password || !cpf || !linkedCompanyCnpj) {
        return new Response(JSON.stringify({ error: "Nome, telefone, email, senha, CPF e empresa vinculada sao obrigatorios" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...Object.fromEntries(corsHeaders) },
        });
      }

      const cpfDigits = cpf.replace(/\D/g, "");
      if (cpfDigits.length !== 11) {
        return new Response(JSON.stringify({ error: "CPF invalido" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...Object.fromEntries(corsHeaders) },
        });
      }

      const linkedCnpjDigits = linkedCompanyCnpj.replace(/\D/g, "");
      if (linkedCnpjDigits.length !== 14) {
        return new Response(JSON.stringify({ error: "CNPJ da empresa vinculada invalido" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...Object.fromEntries(corsHeaders) },
        });
      }

      if (password.length < 8 || password.length > 64 || !/[A-Z]/.test(password) ||
          !/[a-z]/.test(password) || !/\d/.test(password) ||
          !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        return new Response(JSON.stringify({ error: "Senha nao atende aos requisitos" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...Object.fromEntries(corsHeaders) },
        });
      }

      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, phone, company: name, cnpj: cpfDigits, customer_type: "funcionario" },
      });

      if (createErr) {
        const dup = String(createErr.message).toLowerCase().includes("already");
        return new Response(JSON.stringify({
          error: dup ? "Este email ja esta em uso" : createErr.message,
        }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...Object.fromEntries(corsHeaders) },
        });
      }

      if (!created?.user?.id) {
        return new Response(JSON.stringify({ error: "Falha ao criar usuario no Auth" }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...Object.fromEntries(corsHeaders) },
        });
      }

      const userId = created.user.id;

      const { error: roleErr } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: userId, role: "user" });

      if (roleErr) {
        console.error("Failed to insert user role:", roleErr.message);
        const { error: rollbackErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (rollbackErr) console.error("Failed to rollback user deletion:", rollbackErr.message);
        return new Response(JSON.stringify({ error: roleErr.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...Object.fromEntries(corsHeaders) },
        });
      }

      const { error: profileErr } = await supabaseAdmin
        .from("customer_profiles")
        .insert({
          user_id: userId,
          name: name.trim(),
          phone: phone.trim(),
          company: "Clinic+",
          cnpj: cpfDigits,
          customer_type: "funcionario",
          linked_company_cnpj: linkedCnpjDigits,
        });

      if (profileErr) {
        console.error("Failed to insert customer profile:", profileErr.message);
        const { error: rollbackErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (rollbackErr) console.error("Failed to rollback user deletion:", rollbackErr.message);
        return new Response(JSON.stringify({ error: profileErr.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...Object.fromEntries(corsHeaders) },
        });
      }

      return new Response(JSON.stringify({
        message: "Funcionario criado com sucesso",
        user: { id: userId, email },
      }), {
        status: 201,
        headers: { "Content-Type": "application/json", ...Object.fromEntries(corsHeaders) },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Unhandled error in create-employee-user:", msg);
      return new Response(JSON.stringify({ error: msg }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...Object.fromEntries(corsHeaders) },
      });
    }
  },
};
