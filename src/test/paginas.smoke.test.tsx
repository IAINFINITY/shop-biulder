import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { criarSupabaseFalso } from "@/test/supabaseFalso";

/**
 * Teste de fumaça: toda página monta, para todo papel.
 *
 * ## O que ele existe para pegar
 *
 * A limpeza de 19/08/2026 apagou 69 arquivos — 24 componentes de `ui/`, um
 * componente de catálogo de 487 linhas, e ~30 símbolos. `tsc` prova que nada
 * ficou apontando para o que sumiu, mas `tsc` não monta componente: um import
 * que resolve em tempo de compilação pode chegar `undefined` em tempo de
 * execução, e o React só quebra com isso na hora de renderizar.
 *
 * É essa a lacuna. Não se verifica dado nem layout — verifica-se que a árvore
 * monta, com o papel de quem está olhando, e que **nada** foi engolido no
 * caminho.
 *
 * ## As três asserções, e por que as três
 *
 * 1. **Marcador da rota.** Um texto que só existe naquela página. Sem ele, o
 *    teste passaria com o cabeçalho renderizado e o miolo morto dentro de um
 *    Suspense que nunca resolve.
 * 2. **Volume de texto.** Prova que não é um spinner. O limiar é baixo de
 *    propósito: o que se mede é "tem página", não "tem conteúdo certo".
 * 3. **Console limpo de erro de elemento.** `Element type is invalid` é
 *    exatamente o sintoma de import que virou `undefined` — o erro que uma
 *    remoção de arquivo produz. Ele é capturado **durante** a montagem; se
 *    fosse conferido depois, num `it` separado, o array já teria sido zerado e
 *    a asserção não afirmaria nada.
 */

/**
 * Teto de tempo maior, e só neste arquivo.
 *
 * Montar a árvore inteira do `App` — providers, layout, `React.lazy` de cada
 * página — leva alguns segundos no jsdom, e passa dos 5s padrão quando a suíte
 * toda disputa CPU. Rodando o arquivo sozinho passava; junto com os outros 57,
 * `/` e `/conta` estouravam. É lentidão de ambiente, não de produto: afrouxar o
 * teto aqui é mais honesto que afrouxar para os 545 testes.
 */
vi.setConfig({ testTimeout: 30_000 });

const supabaseFalso = criarSupabaseFalso();

vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseFalso }));
vi.mock("@/lib/loadSupabaseClient", () => ({ loadSupabaseClient: async () => supabaseFalso }));

type Papel = "visitante" | "cliente" | "admin" | "superadmin";

let papelAtual: Papel = "visitante";

const PERFIL_CLIENTE = {
  user_id: "u-cliente",
  name: "Cliente de Teste",
  email: "cliente@teste.local",
  phone: "49999999999",
  company: "Clínica Teste",
  cnpj: "12345678000199",
  customer_type: "cliente",
  deve_trocar_senha: false,
  proxis_tpr_id: null,
  is_mei: false,
  address_cep: "89800000",
  address_street: "Rua Teste",
  address_number: "100",
  address_complement: "",
  address_neighborhood: "Centro",
  address_city: "Chapecó",
  address_state: "SC",
  address_ibge: "4204202",
};

function autenticacaoDoPapel(papel: Papel) {
  const ehAdmin = papel === "admin" || papel === "superadmin";
  const logado = papel !== "visitante";

  return {
    user: logado ? { id: `u-${papel}`, email: `${papel}@teste.local` } : null,
    isAdmin: ehAdmin,
    isSuperadmin: papel === "superadmin",
    isCustomer: papel === "cliente",
    customerProfile: papel === "cliente" ? PERFIL_CLIENTE : null,
    deveTrocarSenha: false,
    isPasswordRecovery: false,
    loading: false,
    isResolvingAccess: false,
    acessoResolvidoPara: logado ? `u-${papel}` : null,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signUpCustomer: vi.fn(),
    registerCustomerProfile: vi.fn(),
    requestPasswordReset: vi.fn(),
    signOut: vi.fn(async () => ({ error: null })),
    updateCustomerType: vi.fn(),
    refreshCustomerProfile: vi.fn(),
  };
}

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => autenticacaoDoPapel(papelAtual),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

/** O portão de MFA faz três chamadas de rede ao montar; aqui ele é transparente. */
vi.mock("@/components/auth/GuardaDeSegundoFator", () => ({
  GuardaDeSegundoFator: ({ children }: { children: React.ReactNode }) => children,
}));

/** Erro de import que virou `undefined` — o sintoma que uma remoção produz. */
const SINTOMA_DE_REMOCAO = /Element type is invalid|is not defined|is not a function|Cannot read propert/i;

async function montarEConferir(caminho: string, papel: Papel, marcador: RegExp) {
  papelAtual = papel;
  window.history.pushState({}, "", caminho);

  const capturados: string[] = [];
  const consoleErrorOriginal = console.error;
  console.error = (...args: unknown[]) => {
    capturados.push(args.map(String).join(" "));
  };

  try {
    const { default: App } = await import("@/App");
    render(<App />);

    // As páginas entram por `React.lazy`: sem esperar, o que se mede é o fallback.
    // O casamento é sobre o texto da árvore inteira, não de um elemento só —
    // `getByText` exigiria que um único nó contivesse a expressão inteira, e
    // falharia por motivo de marcação, não por página quebrada.
    await waitFor(
      () => {
        expect(document.body.textContent ?? "").toMatch(marcador);
      },
      { timeout: 15000, interval: 50 },
    );

    const texto = document.body.textContent ?? "";
    // O login inteiro tem 87 caracteres de texto — e uma tela de formulario,
    // quase toda placeholder e rotulo curto. O limiar existe so para separar
    // pagina de spinner.
    expect(texto.length).toBeGreaterThan(60);

    const quebras = capturados.filter((linha) => SINTOMA_DE_REMOCAO.test(linha));
    expect(quebras, `console.error durante ${papel} em ${caminho}`).toEqual([]);
  } finally {
    console.error = consoleErrorOriginal;
  }
}

/** Marcador por rota: texto que só aparece se aquela página realmente montou. */
const MARCADOR = {
  catalogo: /produtos disponíveis|Nenhum produto encontrado|Filtros/i,
  login: /E-mail corporativo/i,
  ajuda: /Senha e segurança|Perguntas frequentes|Atendimento/i,
  pedido: /pedido|carrinho|finalizar/i,
  obrigado: /pedido|análise|atendimento/i,
  favoritos: /Minha lista/i,
  naoEncontrada: /404|Page not found/i,
  conta: /Visão geral|Endereços|Minha conta/i,
  admin: /Dashboard|Produtos|Preços|Visão geral/i,
} as const;

afterEach(cleanup);

describe("páginas montam depois da remoção de código morto", () => {
  describe("visitante", () => {
    const rotas: [string, RegExp][] = [
      ["/", MARCADOR.catalogo],
      ["/login", MARCADOR.login],
      ["/ajuda", MARCADOR.ajuda],
      ["/pedido", MARCADOR.pedido],
      ["/pedido/obrigado", MARCADOR.obrigado],
      ["/favoritos", MARCADOR.favoritos],
      ["/rota-que-nao-existe", MARCADOR.naoEncontrada],
    ];
    for (const [rota, marcador] of rotas) {
      it(`monta ${rota}`, () => montarEConferir(rota, "visitante", marcador));
    }
  });

  describe("cliente", () => {
    const rotas: [string, RegExp][] = [
      ["/", MARCADOR.catalogo],
      ["/conta", MARCADOR.conta],
      ["/favoritos", MARCADOR.favoritos],
      ["/pedido", MARCADOR.pedido],
      ["/ajuda", MARCADOR.ajuda],
    ];
    for (const [rota, marcador] of rotas) {
      it(`monta ${rota}`, () => montarEConferir(rota, "cliente", marcador));
    }
  });

  describe("admin", () => {
    it("monta /admin", () => montarEConferir("/admin", "admin", MARCADOR.admin));
    it("monta o catálogo", () => montarEConferir("/", "admin", MARCADOR.catalogo));
  });

  describe("superadmin", () => {
    it("monta /admin", () => montarEConferir("/admin", "superadmin", MARCADOR.admin));
  });
});
