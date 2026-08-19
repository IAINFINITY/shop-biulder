import { test, expect } from "@playwright/test";

/**
 * O Supabase que o build está usando é o do projeto?
 *
 * ## Por que este teste existe
 *
 * Em 19/08/2026, rodando os testes de navegador pela primeira vez, todas as
 * rotas acusaram 404 em toda consulta. A causa não era o código: o `.env` da
 * máquina apontava para `jpkdgpkkyhibihawkhjw`, um projeto Supabase **vivo mas
 * sem nenhuma tabela deste sistema**, enquanto produção roda em
 * `fjnjktrsiydrfmrzzhhm` — o id que está no CSP do `vercel.json` e no script
 * `gen:types`.
 *
 * O sintoma é traiçoeiro: o site abre, o layout monta, o rodapé aparece, e o
 * catálogo fica vazio. Parece "sem produtos cadastrados", não "apontando para o
 * banco errado". Quem desenvolve assim testa contra o nada sem perceber.
 *
 * Por isso a checagem é um teste separado, com nome próprio: quando falha, ela
 * diz exatamente o que conferir, em vez de virar ruído espalhado por todas as
 * outras rotas.
 */

const TABELAS_ESPERADAS = [
  "clinic+b2b_clinic_catalogo_front_b2b",
  "clinic+b2b_customer_profiles",
  "clinic+b2b_customer_types",
];

test("o Supabase configurado tem as tabelas do projeto", async ({ page, request }) => {
  // Observar a requisição é mais confiável que o Performance API: recurso de
  // outra origem entra lá com detalhe limitado e tempo próprio, e a checagem
  // dependia de a consulta já ter terminado quando o `goto` retornasse.
  let config: string | null = null;
  page.on("request", (req) => {
    const url = req.url();
    if (config === null && url.includes(".supabase.co")) config = new URL(url).origin;
  });

  await page.goto("/", { waitUntil: "networkidle" });

  expect(
    config,
    "o bundle não chamou nenhum host .supabase.co — o build saiu sem VITE_SUPABASE_URL?",
  ).not.toBeNull();

  const faltando: string[] = [];
  for (const tabela of TABELAS_ESPERADAS) {
    const resposta = await request.get(`${config}/rest/v1/${encodeURIComponent(tabela)}?select=*&limit=1`, {
      headers: { apikey: "anon-ausente-de-proposito" },
      failOnStatusCode: false,
    });
    // 401 é a resposta correta para chave inválida: a tabela existe.
    // 404 significa que o PostgREST não conhece a tabela naquele projeto.
    if (resposta.status() === 404) faltando.push(tabela);
  }

  expect(
    faltando,
    `O projeto Supabase em uso (${config}) não tem estas tabelas. ` +
      `Confira VITE_SUPABASE_URL/VITE_SUPABASE_PROJECT_ID no .env: produção é fjnjktrsiydrfmrzzhhm.`,
  ).toEqual([]);
});
