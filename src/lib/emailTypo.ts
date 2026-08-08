// "Você quis dizer gmail.com?"
//
// ## Por que isto existe
//
// A mensagem de erro do login e generica de proposito: a §21 do padrao de
// autenticacao proibe revelar se um e-mail tem conta. "E-mail ou senha
// incorretos" cobre senha errada, e-mail inexistente e e-mail nao confirmado com
// o mesmo texto — e deve continuar assim.
//
// O efeito colateral e que **um erro de digitacao fica indistinguivel de senha
// errada**. Quem digitou `@gmai.com` tenta a mesma senha varias vezes, conclui
// que a conta quebrou, e abre chamado. Aconteceu em teste, com o proprio dono do
// sistema.
//
// ## Por que isto nao fura a §21
//
// A comparacao e contra uma **lista fixa de provedores publicos**, no navegador,
// sem consultar servidor nenhum. `@gmai.com` vira sugestao porque `gmail.com` e
// um dominio conhecido, e nao porque alguem tem conta nele. A resposta e a mesma
// para quem tem conta e para quem nao tem.

/** Provedores comuns no Brasil. Lista fechada: nao consulta nada. */
const DOMINIOS_CONHECIDOS = [
  "gmail.com",
  "hotmail.com",
  "outlook.com",
  "outlook.com.br",
  "yahoo.com",
  "yahoo.com.br",
  "icloud.com",
  "live.com",
  "msn.com",
  "me.com",
  "bol.com.br",
  "uol.com.br",
  "terra.com.br",
  "globo.com",
  "ig.com.br",
];

/**
 * Distancia de edicao entre duas palavras (Levenshtein).
 *
 * Conta quantas insercoes, remocoes ou trocas de letra separam uma da outra.
 * `gmai.com` -> `gmail.com` e 1: falta um `l`.
 */
export function distanciaDeEdicao(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  // Uma linha de cada vez: nao ha por que guardar a matriz inteira.
  let anterior = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i += 1) {
    const atual = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      atual[j] = Math.min(
        atual[j - 1] + 1,        // insercao
        anterior[j] + 1,         // remocao
        anterior[j - 1] + custo, // troca
      );
    }
    anterior = atual;
  }

  return anterior[b.length];
}

/**
 * O e-mail corrigido, quando o dominio parece erro de digitacao.
 *
 * `null` quando nao ha o que sugerir — dominio ja correto, dominio corporativo
 * desconhecido, ou distante demais para ser palpite honesto.
 *
 * O limite de duas edicoes e o que separa "errou uma letra" de "e outro dominio":
 * `gmai.com` e `gmial.com` entram; `gmail.com.br` tambem, por ser 3 a mais, fica
 * de fora de proposito — existe muita empresa com dominio proprio parecido, e
 * sugerir errado e pior do que nao sugerir.
 */
export function sugerirCorrecaoDeEmail(email: unknown): string | null {
  const limpo = String(email ?? "").trim().toLowerCase();
  const arroba = limpo.lastIndexOf("@");
  if (arroba < 1) return null;

  const usuario = limpo.slice(0, arroba);
  const dominio = limpo.slice(arroba + 1);
  if (!usuario || !dominio || !dominio.includes(".")) return null;

  // Dominio certo nao vira sugestao.
  if (DOMINIOS_CONHECIDOS.includes(dominio)) return null;

  let melhor: { dominio: string; distancia: number } | null = null;
  for (const conhecido of DOMINIOS_CONHECIDOS) {
    const distancia = distanciaDeEdicao(dominio, conhecido);
    if (distancia > 2) continue;
    if (!melhor || distancia < melhor.distancia) {
      melhor = { dominio: conhecido, distancia };
    }
  }

  return melhor ? `${usuario}@${melhor.dominio}` : null;
}
