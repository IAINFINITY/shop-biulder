import { test, expect, type Page, type ConsoleMessage } from "@playwright/test";

/**
 * Cada rota pública abre, no navegador de verdade, sem erro de execução.
 *
 * ## Por que existe, além dos testes de montagem em jsdom
 *
 * O jsdom monta a árvore React, mas não executa o bundle: não há code
 * splitting, não há o `inlineCriticalCss`, não há `import()` resolvendo chunk
 * pela rede. A limpeza de 19/08/2026 apagou 24 componentes de `ui/` e um
 * componente de catálogo inteiro — se algum chunk tivesse ficado apontando para
 * o que sumiu, o sintoma apareceria **aqui**, e só aqui.
 *
 * ## A asserção que mais pega
 *
 * Não é o texto da tela: é o `pageerror`. Exceção não capturada em produção
 * costuma deixar a página parcialmente montada, com um pedaço visível o
 * bastante para um teste de conteúdo passar. Coletar exceção e erro de console
 * é o que separa "abriu" de "abriu inteira".
 */

type Coleta = {
  excecoes: string[];
  errosDeConsole: string[];
  requisicoesQuebradas: string[];
};

/**
 * Ruído conhecido do ambiente, que não diz nada sobre o código.
 *
 * A CSP recusa o que o navegador tenta por conta própria (extensão, favicon de
 * terceiro), e o Supabase responde 401/406 em consulta que exige sessão — que é
 * o comportamento correto para visitante anônimo, não uma falha.
 */
const RUIDO = [
  /favicon/i,
  /net::ERR_ABORTED/i,
  /Download the React DevTools/i,
  /React Router Future Flag/i,
  // 4xx do backend não reprova aqui. O que estes testes medem é a integridade do
  // **bundle** — chunk que carrega, rota que resolve, import que não virou
  // indefinido. Se o Supabase configurado estiver vazio ou fora do ar, a página
  // ainda tem de montar com estado vazio, e é isso que se verifica.
  //
  // A disponibilidade do backend não fica escondida por causa disso: ela tem
  // teste próprio, que falha sozinho e com nome claro.
  /Failed to load resource: the server responded with a status of 4\d\d/i,
];

const ehRuido = (texto: string) => RUIDO.some((padrao) => padrao.test(texto));

function coletar(page: Page): Coleta {
  const coleta: Coleta = { excecoes: [], errosDeConsole: [], requisicoesQuebradas: [] };

  page.on("pageerror", (erro) => {
    coleta.excecoes.push(`${erro.name}: ${erro.message}`);
  });

  page.on("console", (msg: ConsoleMessage) => {
    if (msg.type() !== "error") return;
    const texto = msg.text();
    if (!ehRuido(texto)) coleta.errosDeConsole.push(texto);
  });

  page.on("response", (resposta) => {
    const url = resposta.url();
    // Só o que sai do nosso domínio; 4xx do Supabase para anônimo é esperado.
    if (resposta.status() >= 400 && url.includes("localhost") && !ehRuido(url)) {
      coleta.requisicoesQuebradas.push(`${resposta.status()} ${url}`);
    }
  });

  return coleta;
}

async function abrir(page: Page, caminho: string) {
  const coleta = coletar(page);
  const resposta = await page.goto(caminho, { waitUntil: "networkidle" });
  expect(resposta?.status(), `HTTP de ${caminho}`).toBeLessThan(400);
  return coleta;
}

function conferirLimpo(coleta: Coleta, caminho: string) {
  expect(coleta.excecoes, `exceções não capturadas em ${caminho}`).toEqual([]);
  expect(coleta.requisicoesQuebradas, `recursos do app que faltaram em ${caminho}`).toEqual([]);
  expect(coleta.errosDeConsole, `console.error em ${caminho}`).toEqual([]);
}

test.describe("rotas públicas no navegador", () => {
  test("catálogo carrega e lista produtos", async ({ page }) => {
    const coleta = await abrir(page, "/");

    // A busca existe duas vezes na árvore, uma para celular e outra para desktop
    // (`data-catalog-search`). No viewport do teste só uma está visível — filtrar
    // por visibilidade é o que evita pegar a que está escondida por CSS.
    await expect(page.locator('input[data-catalog-search]:visible').first()).toBeVisible();
    await expect(page.locator("body")).toContainText(/produto/i);

    // Catálogo vazio quase sempre significa backend errado, e isso já tem teste
    // próprio (`backend-configurado`). Repetir o vermelho aqui só faria a mesma
    // causa aparecer duas vezes com nomes diferentes.
    const cartoes = await page.locator('a[href^="/produto/"]').count();
    test.skip(cartoes === 0, "catálogo vazio — ver o teste do backend configurado");

    conferirLimpo(coleta, "/");
  });

  test("login mostra os dois caminhos e o formulário", async ({ page }) => {
    const coleta = await abrir(page, "/login");

    await expect(page.getByPlaceholder(/seu@empresa\.com/i)).toBeVisible();
    await expect(page.getByPlaceholder(/sua senha/i)).toBeVisible();
    await expect(page.locator("body")).toContainText(/criar conta/i);

    conferirLimpo(coleta, "/login");
  });

  test("ajuda abre com as seções", async ({ page }) => {
    const coleta = await abrir(page, "/ajuda");
    await expect(page.locator("body")).toContainText(/atendimento/i);
    conferirLimpo(coleta, "/ajuda");
  });

  test("favoritos abre para visitante", async ({ page }) => {
    const coleta = await abrir(page, "/favoritos");
    await expect(page.locator("body")).toContainText(/minha lista/i);
    conferirLimpo(coleta, "/favoritos");
  });

  test("carrinho abre vazio, sem quebrar", async ({ page }) => {
    const coleta = await abrir(page, "/pedido");
    conferirLimpo(coleta, "/pedido");
  });

  test("rota inexistente cai no 404 do app", async ({ page }) => {
    const coleta = coletar(page);
    await page.goto("/rota-que-nao-existe-mesmo");
    await expect(page.locator("body")).toContainText(/404|not found/i);
    // O 404 registra a rota por `console.error` de propósito; só as exceções contam.
    expect(coleta.excecoes).toEqual([]);
  });

  test("abrir um produto a partir do catálogo", async ({ page }) => {
    const coleta = await abrir(page, "/");

    const primeiro = page.locator('a[href^="/produto/"]').first();
    const temProduto = await primeiro.count();
    test.skip(temProduto === 0, "catálogo veio sem produto — nada para abrir");

    await primeiro.click();
    await page.waitForURL(/\/produto\//);
    await expect(page.locator("body")).toContainText(/adicionar|carrinho|R\$/i);

    conferirLimpo(coleta, "/produto/:id");
  });

  test("as áreas privadas não vazam para visitante", async ({ page }) => {
    // /conta e /admin não podem mostrar dado de ninguém sem sessão.
    for (const rota of ["/conta", "/admin"]) {
      const coleta = coletar(page);
      await page.goto(rota, { waitUntil: "networkidle" });
      const corpo = (await page.locator("body").textContent()) ?? "";
      expect(corpo, `${rota} mostrou CNPJ para visitante`).not.toMatch(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
      expect(coleta.excecoes, `exceções em ${rota}`).toEqual([]);
    }
  });
});
