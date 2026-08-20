import http from "node:http";
import { readdirSync } from "node:fs";
import path from "node:path";
import { register } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { config as loadDotenv } from "dotenv";

// As rotas em `api/` importam `src/lib` com extensao `.js`, que e o que a Vercel
// exige. Localmente so existe o `.ts`, entao sem este gancho o carregamento
// falha e nenhuma rota sobe. Precisa vir antes de qualquer `import()` de rota.
register("./tsResolveHook.mjs", import.meta.url);

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

loadDotenv({ path: path.join(rootDir, ".env") });
loadDotenv({ path: path.join(rootDir, ".env.local") });
loadDotenv({ path: path.join(rootDir, ".env.development") });

if (process.env.LOCAL_USE_N8N_PROXY !== "1") {
  process.env.N8N_WEBHOOK_BASE_URL = "";
}

/**
 * As rotas saem da pasta, e nao de uma lista escrita a mao.
 *
 * Aqui havia um array com os dez caminhos digitados um a um. Ele desandava:
 * criar `api/cadastros-pendentes.ts` e esquecer de registrar produzia **404 no
 * servidor local e 200 na Vercel** — que descobre as rotas sozinha. O sintoma
 * chegava como "a tela nao carrega", e nada no codigo da rota estava errado.
 *
 * A regra e a mesma da Vercel: cada arquivo em `api/` vira uma rota, e os que
 * comecam com `_` sao modulos compartilhados (`_auth`, `_rateLimit`), nao
 * endpoints.
 */
const arquivosDeRota = readdirSync(path.join(rootDir, "api"))
  .filter((nome) => nome.endsWith(".ts") && !nome.startsWith("_"))
  .sort();

const handlers = new Map(
  await Promise.all(
    arquivosDeRota.map(async (nome) => {
      const rota = `/api/${nome.replace(/\.ts$/, "")}`;
      const modulo = await import(pathToFileURL(path.join(rootDir, "api", nome)).href);
      return [rota, modulo.default];
    }),
  ),
);

console.log(`[api] ${handlers.size} rota(s): ${[...handlers.keys()].join(", ")}`);

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function createResponse(res) {
  let statusCode = 200;
  return {
    setHeader(name, value) {
      res.setHeader(name, value);
      return this;
    },
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      if (!res.headersSent) {
        res.statusCode = statusCode;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
      }
      res.end(JSON.stringify(payload));
      return this;
    },
    /**
     * `res.send` existe na Vercel e faltava aqui.
     *
     * `api/senha-vazada.ts` responde a faixa do HIBP como texto puro, e o
     * `TypeError: res.status(...).send is not a function` derrubava a rota
     * inteira no dev local. O erro caia no `catch`, virava 502 e a checagem de
     * senha vazada era **pulada em silencio** — porque indisponibilidade da
     * consulta deixa a senha passar de proposito. Ou seja: o defeito era do
     * ambiente de desenvolvimento, mas o efeito era uma protecao desligada sem
     * ninguem perceber.
     *
     * Nao mexe no `Content-Type` ja definido pela rota, ao contrario do `json`.
     */
    send(payload) {
      if (!res.headersSent) {
        res.statusCode = statusCode;
        if (!res.getHeader("Content-Type")) {
          res.setHeader("Content-Type", typeof payload === "string" ? "text/plain; charset=utf-8" : "application/octet-stream");
        }
      }
      res.end(payload);
      return this;
    },
    end(payload) {
      if (!res.headersSent) res.statusCode = statusCode;
      res.end(payload);
      return this;
    },
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1:3000");
  const handler = handlers.get(url.pathname);

  res.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:8080");
  // Authorization e obrigatorio desde que as rotas passaram a exigir o token do
  // Supabase; sem liberar aqui o preflight barra toda chamada no dev local.
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (!handler) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  const rawBody = await readBody(req);
  let body = null;
  if (rawBody.trim()) {
    try {
      body = JSON.parse(rawBody);
    } catch {
      body = rawBody;
    }
  }

  try {
    await handler(
      {
        method: req.method,
        body,
        headers: req.headers,
        query: Object.fromEntries(url.searchParams.entries()),
      },
      createResponse(res),
    );
  } catch (error) {
    console.error(`[local-api] ${url.pathname} failed:`, error);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Local API server failed", detail: error instanceof Error ? error.message : String(error) }));
  }
});

server.listen(3000, "127.0.0.1", () => {
  console.log("[local-api] listening on http://127.0.0.1:3000");
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
