import { test, expect, type Page } from "@playwright/test";

/**
 * Os fluxos que só existem depois do login, nos três papéis.
 *
 * ## Como as credenciais chegam aqui
 *
 * Por variável de ambiente, nunca no arquivo. `scripts/contas-de-teste.mjs`
 * cria as contas e imprime a senha; daí se exporta:
 *
 *   QA_SENHA, QA_EMAIL_CLIENTE, QA_EMAIL_ADMIN, QA_EMAIL_SUPERADMIN
 *
 * Sem elas, o arquivo inteiro é pulado com aviso — em vez de falhar e poluir o
 * relatório de quem só queria rodar as rotas públicas.
 *
 * ## O limite deliberado: nenhum pedido é enviado
 *
 * O checkout é percorrido até a tela de revisão e **para ali**. Apertar o botão
 * final chama `/api/proxis-order` e `/api/bitrix-deal`, que gravam pedido no ERP
 * e negócio no CRM de verdade — dois registros que alguém teria de limpar à mão,
 * num sistema que não é de teste. O que se verifica é que o caminho monta, soma
 * e valida; não que o ERP aceita.
 */

const SENHA = process.env.QA_SENHA ?? "";
const CONTAS = {
  cliente: process.env.QA_EMAIL_CLIENTE ?? "",
  admin: process.env.QA_EMAIL_ADMIN ?? "",
  superadmin: process.env.QA_EMAIL_SUPERADMIN ?? "",
};

test.skip(
  !SENHA || !CONTAS.cliente,
  "sem credenciais de teste (QA_SENHA/QA_EMAIL_*) — rode scripts/contas-de-teste.mjs criar --confirmar",
);

async function entrar(page: Page, email: string) {
  await page.goto("/login");
  await page.getByPlaceholder(/seu@empresa\.com/i).fill(email);
  await page.getByPlaceholder(/sua senha/i).fill(SENHA);
  await page.getByRole("button", { name: /^entrar$/i }).click();

  // O destino muda por papel; o que interessa é ter saído do login.
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
}

function semExcecoes(page: Page) {
  const excecoes: string[] = [];
  page.on("pageerror", (e) => excecoes.push(`${e.name}: ${e.message}`));
  return excecoes;
}

test.describe("cliente", () => {
  test("entra, percorre as seções da conta e sai", async ({ page }) => {
    const excecoes = semExcecoes(page);
    await entrar(page, CONTAS.cliente);

    for (const secao of ["resumo", "empresa", "enderecos", "pedidos", "notificacoes", "mensagens", "seguranca"]) {
      await page.goto(`/conta?section=${secao}`, { waitUntil: "networkidle" });
      await expect(page.locator("body"), `seção ${secao}`).not.toContainText(/Application error|Something went wrong/i);
      expect(excecoes, `exceções na seção ${secao}`).toEqual([]);
    }

    // O próprio cadastro tem de aparecer — é o teste de que a RLS deixa o dono ler.
    await page.goto("/conta?section=empresa", { waitUntil: "networkidle" });
    await expect(page.locator("body")).toContainText(/QA cliente|QA Cliente Ltda/i);
  });

  test("adiciona ao carrinho e chega à revisão, sem enviar", async ({ page }) => {
    const excecoes = semExcecoes(page);
    await entrar(page, CONTAS.cliente);

    await page.goto("/", { waitUntil: "networkidle" });
    const produto = page.locator('a[href^="/produto/"]').first();
    test.skip((await produto.count()) === 0, "catálogo sem produto");
    await produto.click();
    await page.waitForURL(/\/produto\//);

    const adicionar = page.getByRole("button", { name: /adicionar/i }).first();
    await adicionar.click();

    await page.goto("/pedido", { waitUntil: "networkidle" });
    await expect(page.locator("body")).toContainText(/R\$/);

    // Daqui não se passa: o próximo botão grava no ERP e no CRM.
    expect(excecoes).toEqual([]);
  });
});

test.describe("admin", () => {
  test.skip(!CONTAS.admin, "sem QA_EMAIL_ADMIN");

  test("entra no painel e abre as seções permitidas", async ({ page }) => {
    const excecoes = semExcecoes(page);
    await entrar(page, CONTAS.admin);

    await page.goto("/admin", { waitUntil: "networkidle" });
    await expect(page.locator("body")).toContainText(/Dashboard|Visão geral/i);

    for (const rotulo of ["Produtos", "Pedidos", "Clientes", "Preços"]) {
      const botao = page.getByRole("button", { name: new RegExp(`^${rotulo}$`, "i") }).first();
      if ((await botao.count()) === 0) continue; // permissão pode não incluir a seção
      await botao.click();
      await expect(page.locator("body"), `seção ${rotulo}`).not.toContainText(/Application error/i);
    }

    expect(excecoes).toEqual([]);
  });
});

test.describe("superadmin", () => {
  test.skip(!CONTAS.superadmin, "sem QA_EMAIL_SUPERADMIN");

  test("enxerga Usuários, que o admin comum não vê", async ({ page }) => {
    const excecoes = semExcecoes(page);
    await entrar(page, CONTAS.superadmin);

    await page.goto("/admin", { waitUntil: "networkidle" });
    await expect(page.getByRole("button", { name: /^Usuários$/i }).first()).toBeVisible();

    await page.getByRole("button", { name: /^Usuários$/i }).first().click();
    await expect(page.locator("body")).not.toContainText(/Application error/i);

    expect(excecoes).toEqual([]);
  });
});
