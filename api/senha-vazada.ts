import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prefixoValido, TAMANHO_DO_PREFIXO } from "../src/lib/senhaVazada.js";

/**
 * Repassa a consulta de faixa do Have I Been Pwned.
 *
 * O navegador manda **cinco caracteres** do SHA-1 da senha e recebe a faixa
 * inteira que comeca com eles; a comparacao com o proprio sufixo acontece na
 * maquina de quem digitou. Nem esta rota nem o HIBP veem a senha ou o hash
 * completo — e o "protocolo de privacidade" que a §10 exige.
 *
 * ## Por que existe, em vez de o navegador chamar direto
 *
 * Chamar `api.pwnedpasswords.com` do navegador obrigaria a abrir esse host no
 * `connect-src` da CSP. Com a rota propria, a CSP continua em `'self'` mais
 * Supabase — e a CSP e o controle compensatorio do token em `localStorage`, entao
 * afrouxa-la para isto seria trocar uma protecao por outra.
 *
 * ## Sem autenticacao, de proposito
 *
 * A checagem roda no cadastro, antes de existir conta. Exigir token aqui
 * impediria justamente o caso mais importante: a pessoa escolhendo a primeira
 * senha.
 *
 * O que protege do abuso e o formato: cinco caracteres hexadecimais e nada mais.
 * Nao ha o que enumerar — sao 1.048.576 faixas publicas, servidas de graca pelo
 * proprio HIBP.
 */

const HIBP_URL = "https://api.pwnedpasswords.com/range";
const TIMEOUT_MS = 5_000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Método não permitido." });
    return;
  }

  const prefixo = req.query?.prefixo;
  if (!prefixoValido(prefixo)) {
    // Allowlist, e nao escape: o valor entra numa URL, e o formato e conhecido e
    // estreito. Recusar o que nao casa nao depende de adivinhar como o servico do
    // outro lado trata caractere estranho.
    res.status(400).json({
      error: `Informe exatamente ${TAMANHO_DO_PREFIXO} caracteres hexadecimais.`,
    });
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const resposta = await fetch(`${HIBP_URL}/${prefixo.toUpperCase()}`, {
      headers: {
        // Preenche a resposta com linhas artificiais de contagem zero, para o
        // tamanho dela nao revelar quantos hashes reais ha na faixa.
        "Add-Padding": "true",
        "User-Agent": "clinic-plus-b2b",
      },
      signal: controller.signal,
    });

    if (!resposta.ok) {
      console.warn("[senha-vazada] HIBP respondeu", resposta.status);
      res.status(502).json({ error: "Consulta indisponível." });
      return;
    }

    const corpo = await resposta.text();
    // A faixa e publica e nao muda com frequencia; deixar a borda guardar evita
    // repetir a viagem a cada tecla digitada no formulario.
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.status(200).send(corpo);
  } catch (erro) {
    const abortado = erro instanceof Error && erro.name === "AbortError";
    console.warn("[senha-vazada] falha ao consultar:", erro);
    // 502/504 e o suficiente: o cliente trata indisponibilidade deixando passar,
    // porque recusar cadastro por causa de servico de terceiro fora do ar seria
    // transformar a indisponibilidade deles na nossa.
    res.status(abortado ? 504 : 502).json({ error: "Consulta indisponível." });
  } finally {
    clearTimeout(timer);
  }
}
