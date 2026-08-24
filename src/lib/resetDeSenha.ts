import { apiFetch } from "@/lib/apiFetch";

/**
 * Reset de senha para o padrão provisório, a partir do painel.
 *
 * ## O que acontece de fato
 *
 * A senha vira o valor de `clinic+b2b_config_seguranca`, a conta é marcada para
 * **troca obrigatória** no primeiro acesso, e as sessões abertas são encerradas.
 * Os três juntos: sem a troca obrigatória, a pessoa ficaria na senha que o admin
 * conhece; sem encerrar as sessões, quem já estivesse dentro continuaria dentro,
 * o que anularia o reset feito por suspeita de acesso indevido.
 *
 * ## O que o painel não escolhe
 *
 * A senha. Não há parâmetro para isso, de propósito — ver `api/reset-senha.ts`.
 */

export type ResultadoDoReset = {
  /** A senha provisória aplicada, para o admin repassar. */
  senha: string;
};

export async function resetarSenhaParaOPadrao(userId: string): Promise<ResultadoDoReset> {
  const resposta = await apiFetch("/api/reset-senha", {
    method: "POST",
    body: JSON.stringify({ userId }),
  });

  const corpo = (await resposta.json().catch(() => ({}))) as {
    senha?: string;
    error?: string;
    detalhe?: string;
  };

  if (!resposta.ok) {
    throw new Error(corpo.detalhe ?? corpo.error ?? "Não foi possível resetar a senha.");
  }

  return { senha: corpo.senha ?? "" };
}

/**
 * A senha provisória atual.
 *
 * Vem do servidor, e não de uma constante no front. A migration
 * `20260808120000` tirou o valor do repositório e do bundle justamente para ele
 * não estar ao alcance de quem só abre o JavaScript da página — escrevê-lo de
 * volta aqui desfaria isso por conveniência de uma linha.
 */
export async function lerSenhaPadrao(): Promise<string> {
  const resposta = await apiFetch("/api/reset-senha");
  if (!resposta.ok) throw new Error("Não foi possível ler a senha padrão.");
  const corpo = (await resposta.json().catch(() => ({}))) as { senha?: string };
  return corpo.senha ?? "";
}
