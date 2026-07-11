import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

export default {
  fetch: withSupabase({ auth: ["publishable", "secret"] }, async (req, ctx) => {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    // Validate caller is superadmin (only for publishable key mode)
    if (ctx.authMode === "publishable") {
      const { data: { user }, error: authErr } = await ctx.supabaseAdmin.auth.getUser(
        req.headers.get("Authorization")?.replace("Bearer ", "") ?? ""
      );
      if (authErr || !user) {
        return Response.json({ error: "Nao autenticado" }, { status: 401 });
      }

      const { data: hasRole } = await ctx.supabaseAdmin
        .rpc("has_role", { _user_id: user.id, _role: "superadmin" });
      if (!hasRole) {
        return Response.json({ error: "Acesso negado" }, { status: 403 });
      }
    }

    try {
      const body = await req.json();
      const { email, password, displayName, role } = body;

      if (!email || !password) {
        return Response.json({ error: "Email e senha sao obrigatorios" }, { status: 400 });
      }

      if (password.length < 8) {
        return Response.json({ error: "A senha deve ter no mínimo 8 caracteres" }, { status: 400 });
      }

      if (password.length > 64) {
        return Response.json({ error: "A senha deve ter no máximo 64 caracteres" }, { status: 400 });
      }

      if (!/[A-Z]/.test(password)) {
        return Response.json({ error: "A senha deve conter pelo menos uma letra maiúscula" }, { status: 400 });
      }

      if (!/[a-z]/.test(password)) {
        return Response.json({ error: "A senha deve conter pelo menos uma letra minúscula" }, { status: 400 });
      }

      if (!/\d/.test(password)) {
        return Response.json({ error: "A senha deve conter pelo menos um número" }, { status: 400 });
      }

      if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        return Response.json({ error: "A senha deve conter pelo menos um caractere especial" }, { status: 400 });
      }

      const normalizedRole = role ?? "admin";

      // Create user in Supabase Auth via admin API
      const { data: authData, error: createErr } = await ctx.supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: displayName || email.split("@")[0] },
      });

      if (createErr) {
        const dup = createErr.message?.toLowerCase?.()?.includes?.("already") ?? false;
        return Response.json({
          error: dup ? "Este email ja esta em uso" : createErr.message,
        }, { status: 400 });
      }

      const userId = authData!.user!.id;

      // Add role to user_roles
      const { error: roleErr } = await ctx.supabaseAdmin
        .from("user_roles")
        .insert({ user_id: userId, role: normalizedRole });

      if (roleErr) {
        await ctx.supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
        return Response.json({ error: roleErr.message }, { status: 500 });
      }

      // Ensure user role exists
      await ctx.supabaseAdmin
        .from("user_roles")
        .insert({ user_id: userId, role: "user" })
        .catch(() => {});

      // Add to admin_users metadata
      if (normalizedRole !== "user") {
        await ctx.supabaseAdmin
          .from("admin_users")
          .insert({ user_id: userId, display_name: displayName || "", is_active: true })
          .catch(() => {});
      }

      return Response.json({
        message: "Usuario criado com sucesso",
        user: { id: userId, email, role: normalizedRole },
      }, { status: 201 });
    } catch {
      return Response.json({ error: "Erro interno do servidor" }, { status: 500 });
    }
  }),
};
