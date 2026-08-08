import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { validarSenha } from "@/lib/validarSenha";

/**
 * `validarSenha` é a composição — regra local mais base de vazamentos. As duas
 * partes têm teste próprio (`senha.test.ts`, `senhaVazada.test.ts`); o que falta
 * cobrir é a costura entre elas, que é onde mora o comportamento observável
 * pelos seis formulários que chamam esta função.
 */

const SENHA_FORTE = "jacaranda-portao-98-verde";

/** SHA-1 da senha, para montar a resposta da faixa como o HIBP devolveria. */
async function sufixoSha1(senha: string): Promise<{ prefixo: string; sufixo: string }> {
  const bytes = new TextEncoder().encode(senha);
  const digest = await crypto.subtle.digest("SHA-1", bytes);
  const hex = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return { prefixo: hex.slice(0, 5), sufixo: hex.slice(5) };
}

function responderFaixa(corpo: string, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 502,
    text: async () => corpo,
  } as unknown as Response);
}

describe("validarSenha", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", responderFaixa("0000000000000000000000000000000000000:1"));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("aprova senha forte que não está na base de vazamentos", async () => {
    const resultado = await validarSenha(SENHA_FORTE);

    expect(resultado.ok).toBe(true);
    expect(resultado.problema).toBeNull();
    expect(resultado.vazamentoNaoVerificado).toBe(false);
  });

  it("recusa pela regra local sem ir à rede", async () => {
    const chamadas = responderFaixa("");
    vi.stubGlobal("fetch", chamadas);

    const resultado = await validarSenha("123");

    expect(resultado.ok).toBe(false);
    expect(resultado.problema).toBeTruthy();
    // A ordem é o ponto: senha curta não precisa de viagem à rede para cair.
    expect(chamadas).not.toHaveBeenCalled();
  });

  it("recusa senha encontrada na base de vazamentos", async () => {
    const { sufixo } = await sufixoSha1(SENHA_FORTE);
    vi.stubGlobal("fetch", responderFaixa(`${sufixo}:4213`));

    const resultado = await validarSenha(SENHA_FORTE);

    expect(resultado.ok).toBe(false);
    expect(resultado.problema).toBeTruthy();
    expect(resultado.vazamentoNaoVerificado).toBe(false);
  });

  it("deixa passar quando a consulta de vazamento está fora do ar", async () => {
    // Indisponibilidade de terceiro não pode virar cadastro barrado: seria
    // transformar a queda deles na nossa.
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("rede fora")));

    const resultado = await validarSenha(SENHA_FORTE);

    expect(resultado.ok).toBe(true);
    expect(resultado.problema).toBeNull();
    expect(resultado.vazamentoNaoVerificado).toBe(true);
  });

  it("sinaliza não verificado quando a rota responde erro", async () => {
    vi.stubGlobal("fetch", responderFaixa("", false));

    const resultado = await validarSenha(SENHA_FORTE);

    expect(resultado.ok).toBe(true);
    expect(resultado.vazamentoNaoVerificado).toBe(true);
  });

  it("repassa o contexto para a regra local", async () => {
    // O e-mail no contexto é o que permite recusar a senha derivada dele.
    const resultado = await validarSenha("francisco@teste.com.br", { email: "francisco@teste.com.br" });

    expect(resultado.ok).toBe(false);
    expect(resultado.problema).toBeTruthy();
  });

  it("consulta a faixa com o prefixo do próprio hash", async () => {
    const chamadas = responderFaixa("0000000000000000000000000000000000000:1");
    vi.stubGlobal("fetch", chamadas);

    await validarSenha(SENHA_FORTE);

    const { prefixo } = await sufixoSha1(SENHA_FORTE);
    expect(chamadas).toHaveBeenCalledTimes(1);
    // Só o prefixo sai da máquina — é o protocolo de privacidade da §10.
    const url = String(chamadas.mock.calls[0][0]);
    expect(url).toContain(prefixo);
    expect(url).not.toContain(SENHA_FORTE);
  });
});
