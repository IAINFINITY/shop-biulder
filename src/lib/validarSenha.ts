import { avaliarSenha, type ContextoDaSenha } from "@/lib/senha";
import { mensagemDeVazamento, verificarSenhaVazada } from "@/lib/senhaVazada";

/**
 * A validacao completa de senha: regra local mais base de vazamentos.
 *
 * Existe para os seis formularios que pedem senha chamarem **uma** funcao. Antes
 * cada um tinha a sua copia da politica, e foi assim que uma regra proibida pela
 * §10 sobreviveu em seis lugares ao mesmo tempo.
 *
 * ## A ordem importa
 *
 * As checagens locais rodam primeiro e, se alguma falhar, a consulta remota nem
 * acontece. Senha curta demais nao precisa de viagem a rede para ser recusada — e
 * quem esta digitando recebe a resposta na hora.
 */

/** Busca a faixa pela rota propria; ver `api/senha-vazada.ts`. */
async function buscarIntervalo(prefixo: string): Promise<string> {
  const resposta = await fetch(`/api/senha-vazada?prefixo=${encodeURIComponent(prefixo)}`);
  if (!resposta.ok) throw new Error(`consulta respondeu ${resposta.status}`);
  return resposta.text();
}

export type ResultadoDaValidacaoDeSenha = {
  ok: boolean;
  /** Primeira mensagem a mostrar; `null` quando a senha serve. */
  problema: string | null;
  /**
   * `true` quando a base de vazamentos nao respondeu e a senha passou assim
   * mesmo. Serve para o log — a pessoa nao precisa saber.
   */
  vazamentoNaoVerificado: boolean;
};

export async function validarSenha(
  senha: string,
  contexto: ContextoDaSenha = {},
): Promise<ResultadoDaValidacaoDeSenha> {
  const local = avaliarSenha(senha, contexto);
  if (!local.ok) {
    return { ok: false, problema: local.problemas[0], vazamentoNaoVerificado: false };
  }

  const vazamento = await verificarSenhaVazada(senha, buscarIntervalo);
  if (vazamento.vazada) {
    return {
      ok: false,
      problema: mensagemDeVazamento(vazamento.ocorrencias),
      vazamentoNaoVerificado: false,
    };
  }

  return { ok: true, problema: null, vazamentoNaoVerificado: vazamento.indisponivel };
}
