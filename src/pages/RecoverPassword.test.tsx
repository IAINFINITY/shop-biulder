import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import RecoverPassword from "@/pages/RecoverPassword";

/**
 * A tela de senha provisória precisa ter saída.
 *
 * Ela bloqueia o site inteiro até a troca — é isso que faz a troca ser
 * obrigatória de verdade. Mas sem um jeito de sair, quem entrou por engano
 * ficava **preso**: sem menu, sem voltar, sem logout. Foi o que aconteceu num
 * acesso de teste real.
 */

const signOut = vi.fn(async () => ({ error: null }));
const navigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const real = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...real, useNavigate: () => navigate };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "funcionario@clinic.test" },
    loading: false,
    isResolvingAccess: false,
    requestPasswordReset: vi.fn(),
    signOut,
    isPasswordRecovery: false,
    deveTrocarSenha: true,
  }),
}));

function renderizar() {
  return render(
    <MemoryRouter initialEntries={["/recuperar-senha"]}>
      <RecoverPassword />
    </MemoryRouter>,
  );
}

describe("tela de senha provisória", () => {
  it("mostra o formulário de primeiro acesso, e não o de recuperação", () => {
    renderizar();
    // `getAllBy`: o rótulo aparece no cabeçalho e no aviso do formulário.
    expect(screen.getAllByText(/Primeiro acesso/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Senha provisória/i).length).toBeGreaterThan(0);
    // O texto de recuperação não pode vazar: ninguém clicou em link nenhum.
    expect(screen.queryByText(/link de recuperação já foi validado/i)).not.toBeInTheDocument();
  });

  it("oferece uma saída sem trocar a senha", () => {
    renderizar();
    expect(screen.getByRole("button", { name: /sair sem trocar a senha/i })).toBeInTheDocument();
  });

  it("sair encerra a sessão e volta ao login", async () => {
    renderizar();
    fireEvent.click(screen.getByRole("button", { name: /sair sem trocar a senha/i }));
    await waitFor(() => expect(signOut).toHaveBeenCalled());
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith("/login", expect.objectContaining({ replace: true })),
    );
  });
});
