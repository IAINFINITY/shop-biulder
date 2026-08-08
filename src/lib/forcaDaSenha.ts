// O medidor de forca da senha, alinhado com a politica que o sistema aplica.
//
// ## Por que existe num modulo so
//
// Havia tres copias desta funcao — `Account.tsx`, `AdminSettingsSection.tsx` e
// `AdminUsersSection.tsx` — e as tres exibiam "Letra maiuscula", "Numero" e
// "Caractere especial" como requisitos. Sao as "regras arbitrarias de
// composicao" que a §10 do padrao de autenticacao proibe, e que ja tinham saido
// da validacao real (`senha.ts`) sem sair da tela.
//
// Pedir o que nao se cobra nao e so ruido: empurra a pessoa para o `Senha1!`
// — curto, previsivel e exatamente o que a §10 quer evitar — enquanto uma frase
// longa, que passa de verdade, aparece como incompleta.
//
// Copia unica tambem porque foi assim que a regra antiga sobreviveu em seis
// formularios ao mesmo tempo. Ver o comentario de `validarSenha.ts`.

import { avaliarSenha, MIN_SEM_MFA } from "./senha";

export type ForcaDaSenha = {
  label: string;
  score: number;
  checks: { label: string; ok: boolean }[];
};

const ROTULOS = ["Fraca", "Fraca", "Regular", "Média", "Boa", "Forte", "Forte"];

/**
 * Forca da senha, a partir de `avaliarSenha` — a mesma funcao que decide se ela
 * passa. O que aparece na tela e o que sera cobrado no envio.
 */
export function forcaDaSenha(senha: string, email?: string): ForcaDaSenha {
  const avaliacao = avaliarSenha(senha, { email });
  const tamanho = [...senha].length;

  const checks = [
    { label: `Mínimo ${MIN_SEM_MFA} caracteres`, ok: tamanho >= MIN_SEM_MFA },
    {
      label: "Não é uma senha comum",
      ok: !avaliacao.problemas.some((p) => p.includes("listas públicas")),
    },
    {
      label: "Não usa o nome da empresa",
      ok: !avaliacao.problemas.some((p) => p.includes("nome da empresa")),
    },
    {
      label: "Não parece com seu e-mail",
      ok: !avaliacao.problemas.some((p) => p.includes("e-mail")),
    },
  ];

  /**
   * Senha que sera **recusada** nunca aparece como boa.
   *
   * Contar checagens dava nota por maioria: `abc123` (6 caracteres) passava em 3
   * de 4 e aparecia como "Media", e `clinicmais2026` chegava a "Boa" — as duas
   * reprovadas pelo formulario no envio. Medidor que elogia o que sera recusado
   * e pior do que medidor nenhum: ele manda continuar por um caminho sem saida.
   *
   * As reprovacoes aqui sao eliminatorias, nao pontos a somar.
   */
  if (!avaliacao.ok) {
    return { label: ROTULOS[0], score: 0, checks };
  }

  /**
   * Passou no minimo. A partir daqui quem gradua e o **comprimento**, que e o
   * unico fator que cresce sem teto e o que mais pesa contra forca bruta.
   */
  const pontos = tamanho >= 20 ? 6 : tamanho >= 16 ? 5 : tamanho >= 13 ? 4 : 3;

  return { label: ROTULOS[pontos], score: pontos, checks };
}
