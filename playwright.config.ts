import { defineConfig, devices } from "@playwright/test";

/**
 * Testes de navegador contra o **bundle construído**, não contra o dev server.
 *
 * A diferença importa: o `vite build` faz code splitting, aplica o
 * `inlineCriticalCss` e separa os chunks (`tiptap`, `pdf`, `xlsx`). Um import
 * que sumiu na limpeza pode passar pelo dev server — que serve módulo a módulo —
 * e só quebrar no chunk montado. É esse o cenário que aqui se cobre.
 *
 * O `webServer` sobe o `vite preview` sozinho e derruba no fim; não é preciso
 * deixar servidor rodando à mão.
 *
 * ## O que estes testes tocam
 *
 * Só rota pública, e só leitura. O navegador fala com o Supabase de produção
 * com a chave anônima — exatamente o que um visitante faz ao abrir o catálogo.
 * Nada aqui escreve, cria conta ou dispara pedido.
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 2,
  reporter: [["list"]],
  timeout: 60_000,
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run preview",
        url: "http://localhost:4173",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
