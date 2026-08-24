import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErroDeLogin, classificarFalhaDeLogin } from "@/lib/authErrors";

/**
 * O que a tela de login diz quando a entrada falha.
 *
 * ## O bug que originou este arquivo
 *
 * `signIn` devolvia um `Error` com o texto **já traduzido**, e o `Login`
 * chamava `translateAuthErrorMessage` de novo em cima dele. O português da
 * primeira passagem não casava com nenhum ramo da segunda, e caía no fim da
 * função: "Não foi possível concluir. Verifique os dados e tente de novo."
 *
 * O efeito é que **toda** falha de login dizia a mesma coisa — senha errada,
 * e-mail sem conta e e-mail não confirmado, todos com um texto que não ajuda em
 * nenhum dos três casos. Foi exatamente o que o cliente relatou.
 *
 * Os testes de `authErrors.test.ts` cobrem a regra pura e passavam o tempo
 * inteiro, porque o defeito não estava na regra: estava na tela chamando a
 * tradução duas vezes. Por isso este arquivo monta a tela de verdade.
 */

const mensagensDeErro: string[] = [];
const mensagensDeSucesso: string[] = [];

vi.mock("sonner", () => ({
  toast: {
    error: (m: string) => mensagensDeErro.push(m),
    success: (m: string) => mensagensDeSucesso.push(m),
  },
  Toaster: () => null,
}));

const reenviar = vi.fn(async () => ({ data: {}, error: null }));

vi.mock("@/lib/loadSupabaseClient", () => ({
  loadSupabaseClient: async () => ({ auth: { resend: reenviar } }),
}));

let respostaDoSignIn: Error | null = null;
const signIn = vi.fn(async () => respostaDoSignIn);

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: null,
    isAdmin: false,
    loading: false,
    isResolvingAccess: false,
    acessoResolvidoPara: null,
    signIn,
    signUpCustomer: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import Login from "@/pages/Login";

/** A tela segura o erro por 700ms de propósito, para o feedback não piscar. */
const ESPERA = { timeout: 5_000 };

function montar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/login"]}>
        <Login />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function tentarEntrar(email = "alguem@empresa.com", senha = "SenhaQualquer@123") {
  fireEvent.change(screen.getByLabelText(/E-mail corporativo/i), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(/^Senha$/i), { target: { value: senha } });
  fireEvent.click(screen.getByRole("button", { name: /^Entrar$/i }));
}

beforeEach(() => {
  mensagensDeErro.length = 0;
  mensagensDeSucesso.length = 0;
  reenviar.mockClear();
  signIn.mockClear();
});

describe("senha errada ou e-mail sem conta", () => {
  beforeEach(() => {
    respostaDoSignIn = new ErroDeLogin(
      classificarFalhaDeLogin("Invalid login credentials", "invalid_credentials"),
    );
  });

  it("diz que é e-mail ou senha, e não o texto genérico", async () => {
    montar();
    await tentarEntrar();

    await waitFor(() => expect(mensagensDeErro).toHaveLength(1), ESPERA);
    expect(mensagensDeErro[0]).toMatch(/E-mail ou senha incorretos/i);
    // A trava do bug: se a tela voltar a traduzir a própria saída, é este texto
    // que aparece — e o teste falha em vez de a tela emudecer em silêncio.
    expect(mensagensDeErro[0]).not.toMatch(/Não foi possível concluir/i);
  });

  it("oferece as duas saídas, porque não sabemos qual é o caso", async () => {
    montar();
    await tentarEntrar();

    // Recuperar a senha e criar conta aparecem juntos de propósito: distinguir
    // "senha errada" de "e-mail sem conta" revelaria quem é cliente (§21).
    await waitFor(() => expect(screen.getByText(/recupere o acesso/i)).toBeTruthy(), ESPERA);
    expect(screen.getByText(/crie sua conta/i)).toBeTruthy();
  });
});

describe("e-mail ainda não confirmado", () => {
  beforeEach(() => {
    respostaDoSignIn = new ErroDeLogin(
      classificarFalhaDeLogin("Email not confirmed", "email_not_confirmed"),
    );
  });

  it("nomeia o problema em vez de mandar conferir os dados", async () => {
    montar();
    await tentarEntrar();

    await waitFor(() => expect(mensagensDeErro).toHaveLength(1), ESPERA);
    expect(mensagensDeErro[0]).toMatch(/confirmar seu e-mail/i);
  });

  it("oferece o reenvio, e manda para o e-mail digitado", async () => {
    montar();
    await tentarEntrar("pendente@empresa.com");

    const botao = await waitFor(
      () => screen.getByRole("button", { name: /Reenviar e-mail de confirmação/i }),
      ESPERA,
    );
    fireEvent.click(botao);

    await waitFor(() => expect(reenviar).toHaveBeenCalledTimes(1), ESPERA);
    expect(reenviar).toHaveBeenCalledWith({ type: "signup", email: "pendente@empresa.com" });
    await waitFor(() => expect(mensagensDeSucesso[0]).toMatch(/pendente@empresa\.com/), ESPERA);
  });

  it("não oferece reenvio quando o caso é credencial", async () => {
    respostaDoSignIn = new ErroDeLogin(
      classificarFalhaDeLogin("Invalid login credentials", "invalid_credentials"),
    );
    montar();
    await tentarEntrar();

    await waitFor(() => expect(mensagensDeErro).toHaveLength(1), ESPERA);
    expect(screen.queryByRole("button", { name: /Reenviar e-mail de confirmação/i })).toBeNull();
  });
});
