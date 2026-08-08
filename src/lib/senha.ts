/**
 * Politica de senha — a regra, pura e testavel.
 *
 * ## O que estava errado
 *
 * Seis lugares do projeto repetiam a mesma validacao: minimo de 8 caracteres,
 * mais uma maiuscula, uma minuscula, um digito e um caractere especial. A §10 do
 * padrao proibe isso em duas frases:
 *
 *   "regras arbitrarias de composicao NAO DEVEM ser exigidas"
 *   "senha como unico fator DEVE ter mais comprimento que classes de caractere"
 *
 * Nao e preciosismo de norma. Regra de composicao empurra a pessoa para
 * `Senha@123` — que satisfaz as quatro exigencias, tem 9 caracteres e esta em
 * qualquer lista de senha vazada. Enquanto isso, `cavalo bateria grampo correto`
 * era **recusada** por nao ter maiuscula, sendo incomparavelmente mais forte.
 * A regra antiga barrava a senha boa e aprovava a ruim.
 *
 * ## O que entra no lugar
 *
 * Comprimento, mais lista de bloqueio. E o que o NIST recomenda e o que a §10
 * cobra: "signup, alteracao e reset DEVEM consultar blocklist de senhas comuns,
 * contextuais e comprometidas".
 *
 * O comprimento minimo em si — e por que ele nao e o da norma — esta documentado
 * em `MIN_SEM_MFA`, logo abaixo.
 *
 * ## O que ainda falta
 *
 * A parte "comprometidas" e feita fora deste arquivo, em `senhaVazada.ts`, por
 * k-anonimato — cinco caracteres do hash SHA-1, nunca a senha nem o hash inteiro.
 * Este modulo continua puro e sem rede; `validarSenha.ts` junta os dois.
 */

/**
 * Minimos de comprimento.
 *
 * ## Por que 10, e nao os 15 da norma
 *
 * A NIST SP 800-63B-4 diz `SHALL` para 15 quando a senha e fator unico. **Nao
 * cumprimos isso**, por decisao registrada — ver `EXCECOES-REGISTRADAS.md`. O que
 * sustenta a escolha:
 *
 * - Levantamento dos maiores sites do mundo: Google e Microsoft exigem 8;
 *   Amazon, Facebook, LinkedIn e eBay, 6; Netflix, 4. Nos 10.000 sites mais
 *   acessados, 40% exigem 8 e 30% exigem 6. Ninguem comparavel exige 15.
 * - O estudo de Princeton (SOUPS 2022) mediu os 120 maiores sites e concluiu que
 *   o que separa politica boa de ruim **nao e o comprimento**: 71 deles nao
 *   checam vazamento nenhum e aceitam `123456` — a Amazon inclusive. So 15
 *   bloquearam toda a amostra. O criterio de boa pratica do proprio paper e
 *   "8 caracteres OU um medidor de forca".
 *
 * Os 10 ficam acima de Google e Microsoft, e vem acompanhados da peca que aqueles
 * 71 sites nao tem: consulta a base de vazamentos (`senhaVazada.ts`) e limite de
 * tentativas. Comprimento compra resistencia a ataque **offline** — que so entra
 * em jogo se o banco de hashes vazar; contra ataque online, quem protege sao as
 * outras duas.
 *
 * O 8 com MFA continua sendo o da norma.
 */
export const MIN_SEM_MFA = 10;
export const MIN_COM_MFA = 8;

/**
 * Teto de 72 **bytes**, nao caracteres.
 *
 * O bcrypt — que e o que o Supabase usa — ignora o que passa de 72 bytes. Aceitar
 * uma senha maior seria trunca-la em silencio, o que a §10 proibe
 * explicitamente ("a senha NAO DEVE ser truncada silenciosamente"). Recusar com
 * mensagem clara e o comportamento correto.
 *
 * Em bytes porque acento e emoji ocupam mais de um: "coração" tem 7 caracteres e
 * 9 bytes.
 */
export const MAX_BYTES = 72;

/**
 * Senhas comuns o suficiente para estarem em qualquer ataque de dicionario.
 *
 * ## Por que a lista cresceu
 *
 * A versao anterior era curta e dizia o motivo: com o minimo em 15, quase toda
 * senha classica ja caia por comprimento. **Baixar para 10 desfez essa hipotese**
 * — `senha123456`, `1234567890` e `password12` agora cabem. Mexer so na constante
 * teria aberto exatamente as senhas que o comprimento vinha barrando de graca.
 *
 * A defesa principal contra senha vazada continua sendo o HIBP, com a base real.
 * Esta lista e o que resta quando ele nao responde — e ele **falha aberto** de
 * proposito, entao "quando ele nao responde" e um estado que acontece.
 */
const COMUNS = [
  // A faixa que a queda para 10 passou a admitir.
  "1234567890",
  "12345678901",
  "123456789012",
  "0123456789",
  "senha123456",
  "senha12345",
  "password12",
  "password123",
  "qwerty12345",
  "qwertyuiop",
  "admin123456",
  "administrador",
  "brasil12345",
  "abcd1234567",
  "abcdefghij",
  // Herdadas da lista antiga: continuam validas para quem escolhe senha longa.
  "123456789012345",
  "senhasenhasenha",
  "password1234567",
  "administrador123",
  "clinicmais12345",
  "brasil2026brasil",
];

/** Palavras do contexto: senha que contem qualquer uma delas e adivinhavel. */
const CONTEXTUAIS = ["clinicmais", "clinic+", "clinicplus", "chamais", "suplemento", "iainfinity"];

function semAcento(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function bytes(texto: string): number {
  return new TextEncoder().encode(texto).length;
}

/**
 * A senha e so um padrao — sequencia ou repeticao?
 *
 * Uma regra que pega a **classe** vale mais que a lista acima, que so pega os
 * itens que alguem lembrou de escrever. `1234567890` esta na lista; `2345678901`
 * nao estaria, e e igualmente ruim.
 *
 * Cobre dois casos:
 *
 * - **Sequencia**: todo caractere e vizinho do anterior na tabela de codigos,
 *   subindo ou descendo. Pega `1234567890`, `abcdefghij`, `9876543210`.
 *   Se a senha e so digitos, a conta e **modulo 10**, para pegar quem da a volta
 *   no nove: `2345678901` e `7890123456` sao tao previsiveis quanto as outras, e
 *   uma corrida estrita de codigo deixaria as duas passarem.
 * - **Repeticao**: a senha inteira e uma unidade curta repetida. Pega
 *   `abcabcabcabc`, `123123123123`, `aaaaaaaaaa` — este ultimo era a regra do
 *   caractere unico que existia antes, agora como caso particular de unidade de
 *   tamanho 1.
 *
 * A unidade so conta ate metade do comprimento: exigir que caiba duas vezes e o
 * que separa repeticao de senha legitima que por acaso tem inicio e fim
 * parecidos.
 */
function ehSequenciaOuRepeticao(senha: string): boolean {
  const chars = [...senha];
  if (chars.length < 2) return false;

  const soDigitos = /^[0-9]+$/.test(senha);
  const distancia = (atual: string, anterior: string) => {
    const bruta = atual.codePointAt(0)! - anterior.codePointAt(0)!;
    // Modulo 10 leva 9→0 a valer 1, e 0→9 a valer -1.
    return soDigitos ? ((bruta + 10) % 10) || 10 : bruta;
  };

  const passo = distancia(chars[1], chars[0]);
  if (passo === 1 || passo === -1 || (soDigitos && passo === 9)) {
    const emSequencia = chars.every((c, i) => i === 0 || distancia(c, chars[i - 1]) === passo);
    if (emSequencia) return true;
  }

  for (let tamanho = 1; tamanho <= Math.floor(chars.length / 2); tamanho += 1) {
    if (chars.length % tamanho !== 0) continue;
    const unidade = chars.slice(0, tamanho).join("");
    if (unidade.repeat(chars.length / tamanho) === senha) return true;
  }

  return false;
}

export type ContextoDaSenha = {
  /** A conta usa segundo fator? Muda o minimo de comprimento. */
  comMfa?: boolean;
  /** Email da pessoa — a parte antes do @ nao pode virar senha. */
  email?: string | null;
  /** CNPJ do cliente, se houver. */
  cnpj?: string | null;
  /** Nome da pessoa ou da empresa. */
  nome?: string | null;
};

export type AvaliacaoDeSenha = {
  ok: boolean;
  /** Vazio quando `ok`. Primeiro item e o mais util para mostrar. */
  problemas: string[];
};

/**
 * A senha pode ser usada?
 *
 * Devolve **todos** os problemas, e nao so o primeiro: corrigir um por vez, com
 * uma ida ao servidor a cada tentativa, e o que faz a pessoa desistir e escolher
 * a senha mais fraca que passar.
 */
export function avaliarSenha(senha: string, contexto: ContextoDaSenha = {}): AvaliacaoDeSenha {
  const problemas: string[] = [];
  const minimo = contexto.comMfa ? MIN_COM_MFA : MIN_SEM_MFA;

  // Espaco no meio conta; espaco nas pontas tambem, porque a §10 manda aceitar
  // caracteres imprimiveis sem alterar o que a pessoa digitou.
  if ([...senha].length < minimo) {
    problemas.push(
      // A sugestao da frase continua porque ela e o caminho mais facil para uma
      // senha forte — mas agora e sugestao mesmo: com 10, "roxo42banho" passa.
      `A senha precisa de pelo menos ${minimo} caracteres. Uma frase curta que você lembre já resolve: "meu cachorro odeia banho".`,
    );
  }

  if (bytes(senha) > MAX_BYTES) {
    problemas.push(`A senha passou do limite de ${MAX_BYTES} bytes. Use uma um pouco mais curta.`);
  }

  const normalizada = semAcento(senha);

  if (COMUNS.some((comum) => normalizada === comum || normalizada.includes(comum))) {
    problemas.push("Essa senha aparece em listas públicas de senhas vazadas. Escolha outra.");
  }

  for (const termo of CONTEXTUAIS) {
    if (normalizada.includes(termo)) {
      problemas.push("A senha não pode conter o nome da empresa nem do produto.");
      break;
    }
  }

  const local = (contexto.email ?? "").split("@")[0];
  if (local.length >= 4 && normalizada.includes(semAcento(local))) {
    problemas.push("A senha não pode conter o seu e-mail.");
  }

  const digitos = (contexto.cnpj ?? "").replace(/\D/g, "");
  if (digitos.length >= 8 && senha.replace(/\D/g, "").includes(digitos)) {
    problemas.push("A senha não pode conter o CNPJ.");
  }

  const nome = (contexto.nome ?? "").trim();
  if (nome.length >= 4 && normalizada.includes(semAcento(nome))) {
    problemas.push("A senha não pode conter o seu nome.");
  }

  if (senha.length > 0 && ehSequenciaOuRepeticao(senha)) {
    problemas.push(
      "Essa senha é uma sequência ou uma repetição. Ela passa no tamanho, mas é das primeiras que um ataque tenta.",
    );
  }

  return { ok: problemas.length === 0, problemas };
}

/** A primeira mensagem, para quem so tem um `toast` para mostrar. */
export function primeiroProblema(senha: string, contexto: ContextoDaSenha = {}): string | null {
  return avaliarSenha(senha, contexto).problemas[0] ?? null;
}
