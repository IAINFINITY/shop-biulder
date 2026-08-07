import http from "node:http";
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

const handlers = new Map(
  await Promise.all(
    [
      ["/api/proxis-order", "api/proxis-order.ts"],
      ["/api/proxis-health", "api/proxis-health.ts"],
      ["/api/proxis-customer", "api/proxis-customer.ts"],
      ["/api/bitrix-deal", "api/bitrix-deal.ts"],
      ["/api/proxis-price-tables", "api/proxis-price-tables.ts"],
      ["/api/proxis-item-check", "api/proxis-item-check.ts"],
      ["/api/resumo-produto", "api/resumo-produto.ts"],
    ].map(async ([route, file]) => [route, (await import(pathToFileURL(path.join(rootDir, file)).href)).default]),
  ),
);

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
