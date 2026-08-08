/**
 * Aplica UM arquivo de migration no banco, dentro de uma transacao.
 *
 * ## Por que existe, em vez de `supabase db push`
 *
 * O `db push` aplica a fila inteira de `supabase/migrations/`. Neste projeto as
 * migrations antigas foram aplicadas na mao, entao a tabela de controle do
 * Supabase nao sabe delas: o push tentaria reaplicar tudo desde o comeco. Parte
 * e `if not exists` e passaria batido; parte nao, e quebraria no meio.
 *
 * Aqui voce nomeia o arquivo. Nada roda por engano.
 *
 * ## Transacao
 *
 * Tudo dentro de `begin`/`commit`. Se qualquer comando falhar, nada e aplicado —
 * migration pela metade e o pior estado possivel, porque nem o antes nem o depois
 * valem.
 *
 * ## Conexao: tenta duas, na ordem
 *
 * 1. `DIRECT_URL` — conexao direta, o caminho limpo.
 * 2. o pooler em **session mode**, derivado de `DATABASE_URL` trocando a porta
 *    6543 por 5432.
 *
 * A segunda existe porque `db.<ref>.supabase.co` resolve **so em IPv6** nos
 * projetos novos do Supabase. Em rede sem IPv6 — a maioria das redes domesticas e
 * corporativas no Brasil — a conexao direta da `ETIMEDOUT` num endereco `2600:...`
 * e nao ha o que configurar do lado do cliente.
 *
 * O pooler resolve em IPv4. Mas **session mode, nao transaction mode**: a porta
 * 6543 e transaction mode, onde o pgbouncer nao mantem estado entre comandos e
 * atrapalha tanto o DDL quanto os prepared statements que o `pg` usa. A 5432 no
 * mesmo host e session mode, que se comporta como conexao normal.
 *
 * Uso:
 *   node scripts/aplicar-migration.mjs supabase/migrations/<arquivo>.sql
 *   node scripts/aplicar-migration.mjs <arquivo>.sql --dry   (so mostra o SQL)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function lerEnv() {
  const acumulado = {};
  for (const nome of [".env", ".env.local"]) {
    const caminho = path.join(raiz, nome);
    if (!fs.existsSync(caminho)) continue;
    for (const linha of fs.readFileSync(caminho, "utf8").split(/\r?\n/)) {
      if (!linha.includes("=") || linha.trim().startsWith("#")) continue;
      const corte = linha.indexOf("=");
      acumulado[linha.slice(0, corte).trim()] = linha
        .slice(corte + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
    }
  }
  return acumulado;
}

/** O pooler em session mode: mesmo host e credencial, porta 5432. */
function poolerSessionMode(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (!u.hostname.includes("pooler.supabase.com")) return null;
    u.port = "5432";
    return u.toString();
  } catch {
    return null;
  }
}

function esconderCredencial(url) {
  return url.replace(/:\/\/[^@]*@/, "://<credencial>@");
}

/**
 * Erro de rede vale tentar o proximo caminho; erro de SQL nao.
 *
 * O `connectionTimeoutMillis` do `pg` estoura com um `Error` **sem `code`**, so
 * com a mensagem "timeout expired" — checar apenas `erro.code` deixava esse caso
 * de fora e fazia o script anunciar "FALHOU" para uma simples troca de caminho.
 */
function ehFalhaDeRede(erro) {
  if (/timeout expired|Connection terminated due to connection timeout/i.test(erro.message ?? "")) {
    return true;
  }
  return ["ETIMEDOUT", "ENETUNREACH", "ECONNREFUSED", "EHOSTUNREACH", "ENOTFOUND"].includes(
    erro.code,
  );
}

const [alvo, ...flags] = process.argv.slice(2);
if (!alvo) {
  console.error("Uso: node scripts/aplicar-migration.mjs <caminho-do-arquivo.sql> [--dry]");
  process.exit(1);
}

const arquivo = path.isAbsolute(alvo) ? alvo : path.join(raiz, alvo);
if (!fs.existsSync(arquivo)) {
  console.error(`Arquivo nao encontrado: ${arquivo}`);
  process.exit(1);
}

const sql = fs.readFileSync(arquivo, "utf8");
const env = { ...lerEnv(), ...process.env };

const candidatos = [
  { rotulo: "conexao direta", url: env.DIRECT_URL },
  { rotulo: "pooler (session mode)", url: poolerSessionMode(env.DATABASE_URL) },
].filter((candidato) => candidato.url);

if (candidatos.length === 0) {
  console.error("DIRECT_URL e DATABASE_URL ausentes no .env.");
  process.exit(1);
}

console.log(`arquivo : ${path.relative(raiz, arquivo)}`);
console.log(`tamanho : ${sql.split(/\r?\n/).length} linhas`);
console.log(`caminhos: ${candidatos.map((c) => c.rotulo).join(" -> ")}`);

if (flags.includes("--dry")) {
  console.log("\n--- SQL (nada foi executado) ---\n");
  console.log(sql);
  process.exit(0);
}

let aplicado = false;

for (const [indice, candidato] of candidatos.entries()) {
  const cliente = new pg.Client({
    connectionString: candidato.url,
    // O Supabase exige TLS. O certificado e da cadeia deles e o host ja vem
    // fixado na URL, entao a verificacao estrita so atrapalharia aqui.
    ssl: { rejectUnauthorized: false },
    // Sem isto o socket fica pendurado ate o timeout do sistema — minutos de tela
    // parada sem dizer nada. Falhar rapido e poder tentar o proximo.
    connectionTimeoutMillis: 15_000,
  });

  console.log(`\ntentando ${candidato.rotulo}: ${esconderCredencial(candidato.url)}`);

  try {
    await cliente.connect();
    await cliente.query("begin");
    await cliente.query(sql);
    await cliente.query("commit");
    console.log(`OK: aplicado e commitado via ${candidato.rotulo}.`);
    aplicado = true;
    // Um caminho anterior pode ter marcado falha antes de este dar certo. Sem
    // isto o comando sai com codigo de erro depois de aplicar — e quem encadeia
    // com `&&` para no meio achando que quebrou.
    process.exitCode = 0;
  } catch (erro) {
    try {
      await cliente.query("rollback");
    } catch {
      // Conexao ja pode ter caido; o rollback e implicito nesse caso.
    }

    const ultimo = indice === candidatos.length - 1;
    if (ehFalhaDeRede(erro) && !ultimo) {
      // `erro.code` e vazio no timeout do `pg`; cair na mensagem evita imprimir
      // "inalcancavel (undefined)".
      console.warn(`  inalcancavel (${erro.code ?? erro.message}) — tentando o proximo caminho.`);
      continue;
    }

    console.error("\nFALHOU — nada foi aplicado (rollback).");
    console.error(`  ${erro.message}`);
    if (erro.hint) console.error(`  dica: ${erro.hint}`);
    if (erro.position) console.error(`  posicao: ${erro.position}`);
    process.exitCode = 1;
  } finally {
    await cliente.end().catch(() => {});
  }

  if (aplicado) break;
}
