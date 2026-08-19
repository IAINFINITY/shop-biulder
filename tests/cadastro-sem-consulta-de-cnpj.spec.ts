import { test, expect, devices, webkit } from "@playwright/test";

/**
 * O cadastro não pode travar quando a consulta de CNPJ falha.
 *
 * Nasceu como diagnóstico: a tela dizia "você pode preencher a empresa
 * manualmente", a pessoa preenchia, e o botão Continuar recusava com "não foi
 * possível validar o documento agora". Prometia um caminho e negava.
 *
 * Vira teste de regressão porque o custo caía sobre quem menos podia resolver:
 * a BrasilAPI está atrás de Cloudflare e rede móvel usa CGNAT, então o IP da
 * operadora bate em limite muito mais que o IP fixo de um escritório — quem se
 * cadastrava pelo celular era barrado, pelo computador não.
 *
 * `useCnpjValidation` marca `status: "error"` para **qualquer** resposta que não
 * seja 200 nem 404 — 429, 403 de Cloudflare, 5xx, ou queda de rede. Aqui a
 * resposta é forçada, uma condição de cada vez, e se observa o que a tela diz
 * **e se o botão deixa passar**.
 */

// Sem alvo fixo: usa o `baseURL` do playwright.config, que sobe o build local.
// Apontar para produção mediria o código publicado, e um teste de regressão
// precisa medir o que está no repositório.

const CNPJ_VALIDO = "04.163.851/0001-06";

async function cenario(rotulo: string, responder: (rota: import("@playwright/test").Route) => Promise<void>) {
  const navegador = await webkit.launch();
  const contexto = await navegador.newContext({ ...devices["iPhone 13"] });
  const page = await contexto.newPage();

  const avisos: string[] = [];
  page.on("console", (m) => m.type() === "error" && avisos.push(m.text().slice(0, 120)));

  await page.route("**/brasilapi.com.br/**", responder);
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByText(/criar conta/i).first().click();

  const campo = page.locator("#signup-cnpj");
  await campo.waitFor({ state: "visible", timeout: 20_000 });
  await campo.fill(CNPJ_VALIDO);
  await campo.blur();
  await page.waitForTimeout(5000);

  const dica = (await page.locator("body").textContent()) ?? "";
  const inline = dica.match(/Não foi possível[^.]{0,70}\./gi);

  // Preenche a empresa à mão, que é justamente o que a dica manda fazer.
  const empresa = page.getByPlaceholder(/nome da empresa/i).or(page.locator('input[id*="company"], input[id*="empresa"]')).first();
  if ((await empresa.count()) > 0) await empresa.fill("AMAIS INDUSTRIA DE ALIMENTOS LTDA");

  await page.getByRole("button", { name: /continuar/i }).click();
  await page.waitForTimeout(3000);

  const depois = (await page.locator("body").textContent()) ?? "";
  const avancou = /2\.\s*Seus dados/i.test(depois) && /senha/i.test(depois);
  const toast = depois.match(/Não foi possível validar o documento[^.]*\./gi);

  console.log(`\n===== ${rotulo} =====`);
  console.log(`  dica no campo:  ${inline ? JSON.stringify([...new Set(inline)]) : "(nenhuma)"}`);
  console.log(`  avançou para o passo 2? ${avancou ? "SIM" : "NÃO — travado"}`);
  console.log(`  aviso ao clicar: ${toast ? JSON.stringify([...new Set(toast)]) : "(nenhum)"}`);

  await navegador.close();
  return { avancou, inline };
}

test("cadastro segue quando a consulta de CNPJ falha", async () => {
  test.setTimeout(400_000);

  // As três formas de a BrasilAPI falhar. Em todas, o cadastro tem de seguir:
  // o dígito verificador do CNPJ já foi conferido no navegador e a razão social
  // entra à mão. A Receita é conveniência, não autorização.
  const cenarios: [string, (r: import("@playwright/test").Route) => Promise<void>][] = [
    ["429 — limite por IP (típico de rede móvel)", async (r) => r.fulfill({ status: 429, body: "Too Many Requests" })],
    ["403 — bloqueio de bot da Cloudflare", async (r) => r.fulfill({ status: 403, body: "Forbidden" })],
    ["conexão caiu no meio", async (r) => r.abort("connectionfailed")],
  ];

  for (const [rotulo, responder] of cenarios) {
    const { avancou } = await cenario(rotulo, responder);
    expect(avancou, `com "${rotulo}", o cadastro deveria seguir`).toBe(true);
  }

  // Controle: com a consulta funcionando, nada muda.
  const ok = await cenario("200 — controle, tudo funcionando", async (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ razao_social: "AMAIS INDUSTRIA DE ALIMENTOS LTDA", nome_fantasia: "Clinic+" }),
    }),
  );
  expect(ok.avancou).toBe(true);
});
