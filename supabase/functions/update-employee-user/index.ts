import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = new Headers({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
});

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

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
      const { userId, name, phone, email, cpf, linkedCompanyCnpj } = body as {
        userId?: string;
        name?: string;
        phone?: string;
        email?: string;
        cpf?: string;
        linkedCompanyCnpj?: string;
      };

      if (!userId || !name || !phone || !email || !cpf || !linkedCompanyCnpj) {
        return new Response(JSON.stringify({ error: "Nome, telefone, e-mail, CPF, empresa vinculada e userId são obrigatórios" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...Object.fromEntries(corsHeaders) },
        });
      }

      const userIdTrimmed = userId.trim();
      const cpfDigits = onlyDigits(cpf);
      if (cpfDigits.length !== 11) {
        return new Response(JSON.stringify({ error: "CPF inválido" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...Object.fromEntries(corsHeaders) },
        });
      }

      const linkedCnpjDigits = onlyDigits(linkedCompanyCnpj);
      if (linkedCnpjDigits.length !== 14) {
        return new Response(JSON.stringify({ error: "CNPJ da empresa vinculada inválido" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...Object.fromEntries(corsHeaders) },
        });
      }

      const { data: currentUserData, error: currentUserErr } = await supabaseAdmin.auth.admin.getUserById(userIdTrimmed);
      if (currentUserErr || !currentUserData?.user) {
        return new Response(JSON.stringify({ error: "Funcionário não encontrado" }), {
          status: 404,
          headers: { "Content-Type": "application/json", ...Object.fromEntries(corsHeaders) },
        });
      }

      const previousUser = currentUserData.user;
      const previousEmail = previousUser.email ?? email.trim();
      const previousMetadata = previousUser.user_metadata ?? {};

      const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(userIdTrimmed, {
        email: email.trim(),
        user_metadata: {
          ...previousMetadata,
          name: name.trim(),
          phone: phone.trim(),
          company: "Clinic+",
          cnpj: cpfDigits,
          customer_type: "funcionario",
          linked_company_cnpj: linkedCnpjDigits,
        },
      });

      if (authErr) {
        return new Response(JSON.stringify({ error: authErr.message }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...Object.fromEntries(corsHeaders) },
        });
      }

      const { error: profileErr } = await supabaseAdmin
        .from("customer_profiles")
        .upsert(
          {
            user_id: userIdTrimmed,
            name: name.trim(),
            phone: phone.trim(),
            company: "Clinic+",
            cnpj: cpfDigits,
            linked_company_cnpj: linkedCnpjDigits,
            email: email.trim(),
          },
          { onConflict: "user_id" },
        );

      if (profileErr) {
        console.error("Failed to upsert customer profile:", profileErr.message);
        await supabaseAdmin.auth.admin.updateUserById(userIdTrimmed, {
          email: previousEmail,
          user_metadata: previousMetadata,
        }).catch((rollbackErr) => {
          console.error("Failed to rollback auth update:", rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr));
        });

        return new Response(JSON.stringify({ error: profileErr.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...Object.fromEntries(corsHeaders) },
        });
      }

      return new Response(JSON.stringify({
        message: "Funcionário atualizado com sucesso",
        user: { id: userIdTrimmed, email: email.trim() },
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...Object.fromEntries(corsHeaders) },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Unhandled error in update-employee-user:", msg);
      return new Response(JSON.stringify({ error: msg }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...Object.fromEntries(corsHeaders) },
      });
    }
  },
};
