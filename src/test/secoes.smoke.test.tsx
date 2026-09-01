import { describe, expect, it, vi, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { criarSupabaseFalso } from "@/test/supabaseFalso";

/**
 * Cada seção da conta e do painel monta — não só a casca.
 *
 * `paginas.smoke.test.tsx` prova que `/conta` e `/admin` abrem. Isso é pouco:
 * as duas telas são um shell com navegação lateral, e o conteúdo de verdade
 * vive em 7 seções do cliente e 12 do admin, cada uma num componente próprio.
 * A casca montaria intacta com qualquer uma delas quebrada.
 *
 * ## Duas formas de chegar, porque o código é assim
 *
 * A conta lê a seção da URL (`/conta?section=pedidos`) — dá para montar cada
 * uma direto. O painel guarda a seção em `useState`, sem passar pela URL, então
 * só se chega nela **clicando** no menu. O teste segue cada um pelo caminho que
 * ele tem, em vez de forçar um só.
 */

vi.setConfig({ testTimeout: 60_000 });

const supabaseFalso = criarSupabaseFalso();

vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseFalso }));
vi.mock("@/lib/loadSupabaseClient", () => ({ loadSupabaseClient: async () => supabaseFalso }));

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

let ehSuperadmin = false;
let ehAdmin = false;
let ehCliente = false;

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u-teste", email: "teste@teste.local" },
    isAdmin: ehAdmin || ehSuperadmin,
    isSuperadmin: ehSuperadmin,
    isCustomer: ehCliente,
    customerProfile: ehCliente ? PERFIL_CLIENTE : null,
    deveTrocarSenha: false,
    isPasswordRecovery: false,
    loading: false,
    isResolvingAccess: false,
    acessoResolvidoPara: "u-teste",
    signIn: vi.fn(),
    signUp: vi.fn(),
    signUpCustomer: vi.fn(),
    registerCustomerProfile: vi.fn(),
    requestPasswordReset: vi.fn(),
    signOut: vi.fn(async () => ({ error: null })),
    updateCustomerType: vi.fn(),
    refreshCustomerProfile: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/components/auth/GuardaDeSegundoFator", () => ({
  GuardaDeSegundoFator: ({ children }: { children: React.ReactNode }) => children,
}));

const SINTOMA_DE_REMOCAO = /Element type is invalid|is not defined|is not a function|Cannot read propert/i;

function capturarConsole() {
  const capturados: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => capturados.push(args.map(String).join(" "));
  return {
    quebras: () => capturados.filter((l) => SINTOMA_DE_REMOCAO.test(l)),
    restaurar: () => {
      console.error = original;
    },
  };
}

async function montar(caminho: string) {
  window.history.pushState({}, "", caminho);
  const { default: App } = await import("@/App");
  return render(<App />);
}

afterEach(cleanup);

/** As 7 seções da conta do cliente, com o título que cada uma exibe. */
const SECOES_DO_CLIENTE: [string, RegExp][] = [
  ["resumo", /Resumo da conta/i],
  ["empresa", /Dados da empresa/i],
  ["enderecos", /Meus endereços/i],
  ["pedidos", /Meus pedidos/i],
  ["seguranca", /Configurações/i],
  ["mensagens", /Mensagens/i],
  ["notificacoes", /Notificações/i],
  ["meus-dados", /Meus dados/i],
];

describe("seções da conta do cliente", () => {
  for (const [secao, titulo] of SECOES_DO_CLIENTE) {
    it(`monta ?section=${secao}`, async () => {
      ehCliente = true;
      ehAdmin = false;
      ehSuperadmin = false;
      const console = capturarConsole();
      try {
        await montar(`/conta?section=${secao}`);
        await waitFor(() => expect(document.body.textContent ?? "").toMatch(titulo), { timeout: 20000 });
        expect(console.quebras(), `seção ${secao} do cliente`).toEqual([]);
      } finally {
        console.restaurar();
      }
    });
  }
});

/** As 12 seções do painel. O rótulo é o que aparece no menu lateral. */
const SECOES_DO_ADMIN: [string, RegExp][] = [
  ["Dashboard", /Dashboard/i],
  // O título da seção vem do próprio componente ("Banners sob controle do
  // admin"), não de `ADMIN_SECTION_TITLES` — daí o marcador não ser o rótulo.
  ["Banners", /Áreas de banner do site|Banners sob controle do admin/i],
  ["Notificações", /Notificações/i],
  ["Produtos", /Produtos/i],
  ["Imagens", /Imagens/i],
  ["Preços", /Preços/i],
  ["Pedidos", /Pedidos/i],
  ["Clientes", /Clientes/i],
  ["Mensagens", /Mensagens/i],
  // O rótulo virou "Administradores" em 31/08/2026; a chave da seção continua
  // `usuarios`, porque ela está gravada nas permissões de cada conta.
  ["Administradores", /Administradores/i],
  ["Funcionários", /Funcionários/i],
];

describe("seções do painel, como superadmin", () => {
  for (const [rotulo, titulo] of SECOES_DO_ADMIN) {
    it(`abre ${rotulo}`, async () => {
      ehCliente = false;
      ehAdmin = false;
      ehSuperadmin = true;
      const console = capturarConsole();
      try {
        await montar("/admin");
        await waitFor(() => expect(document.body.textContent ?? "").toMatch(/Dashboard/i), { timeout: 20000 });

        // O menu aparece duas vezes (lateral e rodapé no celular); a primeira serve.
        const botoes = screen.getAllByRole("button", { name: new RegExp(`^${rotulo}$`, "i") });
        // `fireEvent` e nao `user-event`: a biblioteca de interacao nao esta
        // instalada, e um clique simples e tudo o que este teste precisa.
        await act(async () => {
          fireEvent.click(botoes[0]);
        });

        await waitFor(() => expect(document.body.textContent ?? "").toMatch(titulo), { timeout: 20000 });
        expect(console.quebras(), `seção ${rotulo} do painel`).toEqual([]);
      } finally {
        console.restaurar();
      }
    });
  }
});

describe("o painel respeita o papel", () => {
  it("superadmin enxerga Administradores; a seção existe no menu", async () => {
    ehCliente = false;
    ehAdmin = false;
    ehSuperadmin = true;
    await montar("/admin");
    await waitFor(() => expect(document.body.textContent ?? "").toMatch(/Dashboard/i), { timeout: 20000 });
    expect(screen.getAllByRole("button", { name: /^Administradores$/i }).length).toBeGreaterThan(0);
  });

  it("admin sem permissão não recebe o menu de Administradores", async () => {
    ehCliente = false;
    ehAdmin = true;
    ehSuperadmin = false;
    await montar("/admin");
    await waitFor(() => expect(document.body.textContent ?? "").toMatch(/Dashboard|Visão geral/i), { timeout: 20000 });
    // `canAccessAdminSection` reserva a seção ao superadmin — ver adminUsers.ts.
    expect(screen.queryAllByRole("button", { name: /^Administradores$/i })).toEqual([]);
  });
});
