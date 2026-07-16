import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = new Headers({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
});

const CUSTOMER_PROFILES_TABLE = "customer_profiles";
const CUSTOMER_ADDRESSES_TABLE = "customer_addresses";
const CUSTOMER_TYPE_OVERRIDES_TABLE = "customer_type_overrides";
const ORDERS_TABLE = "orders";

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function isNotFoundError(message: string): boolean {
  return /not found|não encontrado|nao encontrado/i.test(message);
}

async function deleteIfAny(
  supabaseAdmin: ReturnType<typeof createClient>,
  table: string,
  column: string,
  value: string,
): Promise<void> {
  const { error } = await supabaseAdmin.from(table).delete().eq(column, value);
  if (error) throw error;
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
      const { userId, cnpj } = body as {
        userId?: string;
        cnpj?: string;
      };

      const normalizedUserId = typeof userId === "string" ? userId.trim() : "";
      const normalizedCnpj = typeof cnpj === "string" ? onlyDigits(cnpj).slice(0, 14) : "";

      if (!normalizedUserId && !normalizedCnpj) {
        return new Response(JSON.stringify({ error: "userId ou cnpj e obrigatorio" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...Object.fromEntries(corsHeaders) },
        });
      }

      const profileLookup = normalizedUserId
        ? await supabaseAdmin
            .from(CUSTOMER_PROFILES_TABLE)
            .select("user_id, cnpj")
            .eq("user_id", normalizedUserId)
            .maybeSingle()
        : normalizedCnpj
          ? await supabaseAdmin
              .from(CUSTOMER_PROFILES_TABLE)
              .select("user_id, cnpj")
              .eq("cnpj", normalizedCnpj)
              .maybeSingle()
          : { data: null, error: null };

      if (profileLookup.error) {
        return new Response(JSON.stringify({ error: profileLookup.error.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...Object.fromEntries(corsHeaders) },
        });
      }

      const profileUserId = (profileLookup.data?.user_id ?? normalizedUserId) || "";
      const profileCnpj = onlyDigits(profileLookup.data?.cnpj ?? normalizedCnpj);

      if (profileUserId) {
        const { error: deleteErr } = await supabaseAdmin.auth.admin.deleteUser(profileUserId);
        if (deleteErr && !isNotFoundError(deleteErr.message)) {
          return new Response(JSON.stringify({ error: deleteErr.message }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...Object.fromEntries(corsHeaders) },
          });
        }

        await deleteIfAny(supabaseAdmin, CUSTOMER_ADDRESSES_TABLE, "user_id", profileUserId);
        await deleteIfAny(supabaseAdmin, CUSTOMER_PROFILES_TABLE, "user_id", profileUserId);
      }

      if (profileCnpj) {
        await deleteIfAny(supabaseAdmin, CUSTOMER_TYPE_OVERRIDES_TABLE, "cnpj", profileCnpj);
      }

      if (!profileUserId && normalizedCnpj) {
        const { error: ordersErr } = await supabaseAdmin
          .from(ORDERS_TABLE)
          .delete()
          .eq("customer_cnpj", normalizedCnpj);

        if (ordersErr) {
          return new Response(JSON.stringify({ error: ordersErr.message }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...Object.fromEntries(corsHeaders) },
          });
        }
      }

      return new Response(JSON.stringify({ message: "Usuario excluido com sucesso" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...Object.fromEntries(corsHeaders) },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Unhandled error in delete-customer-user:", msg);
      return new Response(JSON.stringify({ error: msg }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...Object.fromEntries(corsHeaders) },
      });
    }
  },
};
