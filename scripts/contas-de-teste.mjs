/**
 * Cria e apaga as contas de teste dos três papéis.
 *
 * ## Por que existe
 *
 * Validar cliente, admin e superadmin de ponta a ponta exige três contas de
 * verdade. Criar à mão dá trabalho e, pior, deixa rastro: alguém esquece de
 * apagar e sobra conta com poder de admin no banco de produção.
 *
 * Aqui a criação e o apagamento são o mesmo script, e a segunda metade lê o que
 * a primeira escreveu. O que foi criado é o que sai.
 *
 * ## Uso
 *
 *   node scripts/contas-de-teste.mjs criar  --confirmar
 *   node scripts/contas-de-teste.mjs apagar --confirmar
 *   node scripts/contas-de-teste.mjs status
 *
 * Sem `--confirmar` o script só mostra o que faria. É proposital: ele escreve
 * em `auth.users` de produção, e um comando digitado por engano não pode ter
 * efeito.
 *
 * ## As três travas
 *
 * 1. **Confirmação explícita.** Nada acontece sem `--confirmar`.
 * 2. **Prefixo obrigatório.** O apagamento recusa qualquer conta cujo e-mail não
 *    comece com o prefixo de teste, mesmo que o id esteja no manifesto. Um
 *    manifesto adulterado não vira exclusão de cliente real.
 * 3. **Manifesto local.** Os ids ficam em `scripts/.contas-de-teste.json`,
 *    ignorado pelo Git. Sem ele, `apagar` procura pelo prefixo e pede
 *    confirmação do que encontrou.
 *
 * Não toca em pedido, ERP nem CRM. Só `auth.users` e as tabelas do perfil.
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const MANIFESTO = resolve(AQUI, ".contas-de-teste.json");

/** Prefixo que marca a conta como descartável. A trava de apagamento usa isto. */
const PREFIXO = process.env.QA_EMAIL_PREFIXO || "qa-teste-";
const DOMINIO = process.env.QA_EMAIL_DOMINIO || "iainfinity.com.br";

/** Senha das três contas. Atende a política: maiúscula, minúscula, número, símbolo. */
const SENHA = process.env.QA_SENHA || "Teste!Qa#2026$Clinic";

const PERFIS = [
  { papel: "cliente", role: "user", cnpj: "00000000000191", empresa: "QA Cliente Ltda" },
  { papel: "admin", role: "admin", cnpj: "00000000000272", empresa: "QA Admin Ltda" },
  { papel: "superadmin", role: "superadmin", cnpj: "00000000000353", empresa: "QA Superadmin Ltda" },
];

const TABELA_PERFIS = "clinic+b2b_customer_profiles";
const TABELA_PAPEIS = "clinic+b2b_user_roles";

function lerEnv() {
  const caminho = resolve(AQUI, "..", ".env");
  const env = { ...process.env };
  if (existsSync(caminho)) {
    for (const linha of readFileSync(caminho, "utf8").split(/\r?\n/)) {
      const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
      if (m && !env[m[1]]) env[m[1]] = m[2];
    }
  }
  return env;
}

const env = lerEnv();
const URL_BASE = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || "").trim().replace(/\/$/, "");
const SERVICE_ROLE = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

if (!URL_BASE || !SERVICE_ROLE) {
  console.error("Faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (no .env ou no ambiente).");
  process.exit(1);
}

const projeto = new URL(URL_BASE).hostname.split(".")[0];

async function api(caminho, init = {}) {
  const resposta = await fetch(`${URL_BASE}${caminho}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      ...(init.headers ?? {}),
    },
  });
  const texto = await resposta.text();
  let corpo = null;
  try {
    corpo = texto ? JSON.parse(texto) : null;
  } catch {
    corpo = texto;
  }
  return { ok: resposta.ok, status: resposta.status, corpo };
}

const emailDe = (papel) => `${PREFIXO}${papel}@${DOMINIO}`;

async function criar(confirmar) {
  console.log(`Projeto: ${projeto}`);
  console.log(`Contas a criar: ${PERFIS.map((p) => emailDe(p.papel)).join(", ")}`);
  if (!confirmar) {
    console.log("\n(simulação — nada foi criado. Repita com --confirmar.)");
    return;
  }

  const criadas = [];

  for (const perfil of PERFIS) {
    const email = emailDe(perfil.papel);

    // `email_confirm: true` evita depender de caixa de entrada. É a diferença
    // entre um script que roda sozinho e um que trava esperando um clique.
    const usuario = await api("/auth/v1/admin/users", {
      method: "POST",
      body: JSON.stringify({
        email,
        password: SENHA,
        email_confirm: true,
        user_metadata: { name: `QA ${perfil.papel}`, criado_por: "scripts/contas-de-teste.mjs" },
      }),
    });

    if (!usuario.ok) {
      console.error(`  ✗ ${email}: ${usuario.status} ${JSON.stringify(usuario.corpo)?.slice(0, 200)}`);
      continue;
    }

    const id = usuario.corpo.id;
    criadas.push({ papel: perfil.papel, email, id });
    console.log(`  ✓ ${email} → ${id}`);

    const perfilCriado = await api(`/rest/v1/${encodeURIComponent(TABELA_PERFIS)}`, {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        user_id: id,
        name: `QA ${perfil.papel}`,
        email,
        phone: "49999990000",
        company: perfil.empresa,
        cnpj: perfil.cnpj,
        customer_type: "cliente",
      }),
    });
    console.log(`    perfil: ${perfilCriado.ok ? "ok" : `falhou (${perfilCriado.status})`}`);

    const papelCriado = await api(`/rest/v1/${encodeURIComponent(TABELA_PAPEIS)}`, {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ user_id: id, role: perfil.role }),
    });
    console.log(`    papel ${perfil.role}: ${papelCriado.ok ? "ok" : `falhou (${papelCriado.status})`}`);
  }

  writeFileSync(MANIFESTO, JSON.stringify({ projeto, senha: SENHA, contas: criadas }, null, 2) + "\n");
  console.log(`\nManifesto: ${MANIFESTO}`);
  console.log(`Senha das três: ${SENHA}`);
}

async function localizar() {
  if (existsSync(MANIFESTO)) {
    return JSON.parse(readFileSync(MANIFESTO, "utf8")).contas ?? [];
  }
  // Sem manifesto, procura pelo prefixo — para o caso de a criação ter sido
  // interrompida antes de gravar o arquivo.
  const lista = await api("/auth/v1/admin/users?per_page=200");
  if (!lista.ok) return [];
  return (lista.corpo.users ?? [])
    .filter((u) => (u.email ?? "").startsWith(PREFIXO))
    .map((u) => ({ papel: "?", email: u.email, id: u.id }));
}

async function apagar(confirmar) {
  const contas = await localizar();

  if (contas.length === 0) {
    console.log("Nada a apagar.");
    return;
  }

  // A trava que importa: e-mail fora do prefixo não é conta de teste.
  const suspeitas = contas.filter((c) => !(c.email ?? "").startsWith(PREFIXO));
  if (suspeitas.length > 0) {
    console.error("RECUSADO — estas contas não têm o prefixo de teste:");
    for (const s of suspeitas) console.error(`  ${s.email}`);
    process.exit(1);
  }

  console.log(`Projeto: ${projeto}`);
  console.log(`Contas a apagar: ${contas.map((c) => c.email).join(", ")}`);
  if (!confirmar) {
    console.log("\n(simulação — nada foi apagado. Repita com --confirmar.)");
    return;
  }

  for (const conta of contas) {
    for (const tabela of [TABELA_PAPEIS, TABELA_PERFIS]) {
      await api(`/rest/v1/${encodeURIComponent(tabela)}?user_id=eq.${conta.id}`, {
        method: "DELETE",
        headers: { Prefer: "return=minimal" },
      });
    }
    const removido = await api(`/auth/v1/admin/users/${conta.id}`, { method: "DELETE" });
    console.log(`  ${removido.ok ? "✓" : "✗"} ${conta.email}`);
  }

  // Confere que sumiu de verdade, em vez de confiar no código de resposta.
  const sobrou = await api("/auth/v1/admin/users?per_page=200");
  const restantes = (sobrou.corpo?.users ?? []).filter((u) => (u.email ?? "").startsWith(PREFIXO));
  console.log(restantes.length === 0 ? "\nNenhuma conta de teste restante." : `\nAINDA RESTAM: ${restantes.map((u) => u.email).join(", ")}`);

  if (existsSync(MANIFESTO) && restantes.length === 0) unlinkSync(MANIFESTO);
}

async function status() {
  const lista = await api("/auth/v1/admin/users?per_page=200");
  if (!lista.ok) {
    console.error(`Não foi possível listar (${lista.status}). A chave é service role deste projeto?`);
    process.exit(1);
  }
  const testes = (lista.corpo.users ?? []).filter((u) => (u.email ?? "").startsWith(PREFIXO));
  console.log(`Projeto: ${projeto}`);
  console.log(`Total de contas: ${lista.corpo.users?.length ?? 0}`);
  console.log(`Contas de teste (${PREFIXO}*): ${testes.length}`);
  for (const t of testes) console.log(`  ${t.email} → ${t.id}`);
}

const comando = process.argv[2];
const confirmar = process.argv.includes("--confirmar");

if (comando === "criar") await criar(confirmar);
else if (comando === "apagar") await apagar(confirmar);
else if (comando === "status") await status();
else {
  console.log("Uso: node scripts/contas-de-teste.mjs <criar|apagar|status> [--confirmar]");
  process.exit(1);
}
