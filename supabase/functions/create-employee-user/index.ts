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
      // `password` saiu da desestruturacao: esta funcao **ignora** o que vem no
      // corpo e usa a senha provisoria da configuracao. Exigir o campo obrigava
      // o painel a mandar um valor que seria jogado fora — e foi o que fez o
      // formulario pedir, validar e descartar uma senha, criando a conta com
      // outra. Corpo antigo que ainda mande `password` continua funcionando: o
      // campo simplesmente nao e lido.
      const { name, phone, email, cpf, linkedCompanyCnpj } = body as {
        name?: string; phone?: string; email?: string;
        cpf?: string; linkedCompanyCnpj?: string;
      };

      if (!name || !phone || !email || !cpf || !linkedCompanyCnpj) {
        return new Response(JSON.stringify({ error: "Nome, telefone, e-mail, CPF e empresa vinculada são obrigatórios" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...Object.fromEntries(corsHeaders) },
        });
      }

      const cpfDigits = cpf.replace(/\D/g, "");
      if (cpfDigits.length !== 11) {
        return new Response(JSON.stringify({ error: "CPF inválido" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...Object.fromEntries(corsHeaders) },
        });
      }

      const linkedCnpjDigits = linkedCompanyCnpj.replace(/\D/g, "");
      if (linkedCnpjDigits.length !== 14) {
        return new Response(JSON.stringify({ error: "CNPJ da empresa vinculada inválido" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...Object.fromEntries(corsHeaders) },
        });
      }

      // A senha provisoria vem do banco, nao do corpo da requisicao.
      //
      // Antes ela chegava do navegador — o que significa que quem chamasse esta
      // funcao escolhia a senha do funcionario criado. E o valor morava em
      // `src/lib/employeeBulkImport.ts`, versionado no git e presente no bundle.
      //
      // Agora e lida de `clinic+b2b_config_seguranca`, tabela sem policy: so o
      // service role alcanca. O `password` do corpo passa a ser ignorado.
      const { data: config, error: configErr } = await supabaseAdmin
        .from("clinic+b2b_config_seguranca")
        .select("valor")
        .eq("chave", "senha_padrao_funcionario")
        .maybeSingle();

      const senhaProvisoria = config?.valor;
      if (configErr || !senhaProvisoria) {
        console.error("[create-employee-user] senha provisoria ausente:", configErr);
        return new Response(
          JSON.stringify({ error: "Configuração de senha provisória ausente. Fale com o suporte." }),
          { status: 503, headers: { "Content-Type": "application/json", ...Object.fromEntries(corsHeaders) } },
        );
      }

      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: senhaProvisoria,
        email_confirm: true,
        user_metadata: {
          name,
          phone,
          company: "Clinic+",
          cnpj: cpfDigits,
          customer_type: "funcionario",
          linked_company_cnpj: linkedCnpjDigits,
        },
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

      const { error: profileErr } = await supabaseAdmin
        .from("clinic+b2b_customer_profiles")
        .upsert(
          {
            user_id: userId,
            name: name.trim(),
            phone: phone.trim(),
            company: "Clinic+",
            cnpj: cpfDigits,
            linked_company_cnpj: linkedCnpjDigits,
            email: email.trim(),
            // Define o preco que a pessoa ve: `funcionario` liga a tabela Clinic
            // 2026 Funcionarios, que nao existe no Proxis e mora so no site.
            // Sem isto o perfil nasce `cliente`, a sincronizacao com o ERP
            // carimba a tabela 8728 e o funcionario ve preco de representante.
            customer_type: "funcionario",
            // Senha provisoria conhecida pelo admin: a pessoa troca antes de
            // usar o site. Marcado aqui, no servidor, e nao pelo navegador —
            // quem cria nao deveria poder decidir nao marcar.
            deve_trocar_senha: true,
          },
          { onConflict: "user_id" },
        );

      if (profileErr) {
        console.error("Failed to upsert customer profile:", profileErr.message);
        const { error: rollbackErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (rollbackErr) console.error("Failed to rollback user deletion:", rollbackErr.message);
        return new Response(JSON.stringify({ error: profileErr.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...Object.fromEntries(corsHeaders) },
        });
      }

      return new Response(JSON.stringify({
        message: "Funcionário criado com sucesso",
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
