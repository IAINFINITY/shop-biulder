import { randomBytes } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAuth } from "./_auth.js";
import { aplicarRateLimit } from "./_rateLimit.js";
import {
  avaliarDispositivo,
  BYTES_DO_TOKEN,
  calcularExpiracao,
  rotularDispositivo,
  type RegistroDeDispositivo,
} from "../src/lib/dispositivoConfiavel.js";
import {
  ehHttps,
  hashDoToken,
  lerCookieDeDispositivo,
  nomeDoCookie,
  TABELA_DISPOSITIVOS,
} from "./_dispositivo.js";

/**
 * "Lembrar deste aparelho" — emissao e validacao.
 *
 * Resolve o atrito que o usuario relatou: sair e entrar pedia o codigo do
 * autenticador toda vez, enquanto Google e GitHub pedem uma vez e lembram do
 * navegador.
 *
 * ## Por que isto e uma rota, e nao logica no navegador
 *
 * Porque a credencial precisa valer para o SERVIDOR. O `_auth.ts` recusa rota de
 * admin sem `aal2`, e o Supabase so emite `aal2` depois de verificar um fator —
 * nao ha API para "confie neste aparelho". Se o front pulasse o desafio por
 * conta propria, o token continuaria `aal1` e o painel quebraria no dia em que
 * `MFA_ADMIN_OBRIGATORIO=1` subir. Fachada, no vocabulario da §31.
 *
 * ## O token nunca volta ao banco
 *
 * Gravamos `sha256(token)`. Quem obtiver um dump nao consegue se passar por
 * ninguem — mesma razao de nao guardar senha em claro. E o que a §14 chama de
 * "armazenada como hash".
 *
 * ## As duas acoes
 *
 * `registrar` — exige `aal2`. E o que impede a confianca de dispositivo de
 * "substituir MFA silenciosamente" (§17): so se ganha o direito de pular o
 * proximo desafio depois de ter passado por um.
 *
 * `validar` — troca o token por um novo a cada uso (§14, "rotacionada a cada
 * uso"). Nao exige `aal2`, obviamente: e o que se chama para descobrir se o
 * desafio pode ser dispensado.
 */



/**
 * O cabecalho do cookie. Nome, `Secure` e leitura vem de `_dispositivo.ts`, para
 * `_auth.ts` e esta rota nunca discordarem sobre qual cookie e o certo.
 *
 * `HttpOnly` de proposito: JavaScript da pagina nao le. A EX-001 ja registra o
 * token de sessao em `localStorage` como fraqueza aceita; repetir o padrao aqui
 * somaria uma segunda credencial ao alcance de qualquer XSS — e esta dispensa o
 * segundo fator, que e justamente a defesa contra sessao roubada.
 */
function cabecalhoDeCookie(req: VercelRequest, token: string, expiraEm: string): string {
  const segundos = Math.max(0, Math.floor((new Date(expiraEm).getTime() - Date.now()) / 1000));
  return [
    `${nomeDoCookie(req)}=${token}`,
    "Path=/",
    "HttpOnly",
    ...(ehHttps(req) ? ["Secure"] : []),
    // `Lax` e nao `Strict`: com `Strict` o cookie nao viaja quando a pessoa chega
    // por um link de fora (o e-mail de recuperacao, por exemplo), e ela veria o
    // desafio sem motivo. `Lax` ja barra o uso em requisicao de terceiro.
    "SameSite=Lax",
    `Max-Age=${segundos}`,
  ].join("; ");
}

function urlDoSupabase(): string {
  return (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim().replace(/\/$/, "");
}

function chaveDeServico(): string {
  return (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
}

async function supabase(caminho: string, init: RequestInit = {}): Promise<Response> {
  const chave = chaveDeServico();
  return fetch(`${urlDoSupabase()}/rest/v1/${caminho}`, {
    ...init,
    headers: {
      apikey: chave,
      Authorization: `Bearer ${chave}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

type LinhaDoBanco = {
  id: string;
  user_id: string;
  token_hash: string;
  rotulo: string | null;
  expira_em: string;
  revogado_em: string | null;
  rotacionado_em: string | null;
};

function paraRegistro(linha: LinhaDoBanco): RegistroDeDispositivo {
  return {
    tokenHash: linha.token_hash,
    expiraEm: linha.expira_em,
    revogadoEm: linha.revogado_em,
    rotacionadoEm: linha.rotacionado_em,
  };
}

/**
 * Revoga TODOS os aparelhos do usuario.
 *
 * Chamado quando um token ja rotacionado reaparece. Nao da para saber qual das
 * duas copias esta com a pessoa certa, entao a unica resposta honesta e derrubar
 * todas e exigir o codigo de novo. Recusar so aquela tentativa deixaria a copia
 * boa circulando nas maos de quem a copiou.
 */
async function revogarTudo(userId: string): Promise<void> {
  await supabase(`${encodeURIComponent(TABELA_DISPOSITIVOS)}?user_id=eq.${userId}&revogado_em=is.null`, {
    method: "PATCH",
    body: JSON.stringify({ revogado_em: new Date().toISOString() }),
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método não permitido." });
    return;
  }

  const auth = await requireAuth(req, res);
  if (!auth) return;

  if (!(await aplicarRateLimit(req, res, "dispositivo-confiavel", auth.userId))) return;

  const acao = (req.body as { acao?: unknown })?.acao;

  if (acao === "registrar") {
    // A trava da §17. `aal2` aqui significa: esta sessao passou pelo segundo
    // fator agora ha pouco. Sem isto, qualquer sessao `aal1` roubada poderia se
    // auto-promover a "aparelho confiavel" e nunca mais ver um desafio.
    if (auth.aal !== "aal2") {
      res.status(403).json({ error: "Confirme o segundo fator antes de lembrar deste aparelho." });
      return;
    }

    const token = randomBytes(BYTES_DO_TOKEN).toString("base64url");
    const agora = new Date();
    const criacao = await supabase(encodeURIComponent(TABELA_DISPOSITIVOS), {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        user_id: auth.userId,
        token_hash: hashDoToken(token),
        rotulo: rotularDispositivo(req.headers["user-agent"] ?? null),
        expira_em: calcularExpiracao(agora),
      }),
    });

    if (!criacao.ok) {
      console.error("[dispositivo-confiavel] falha ao registrar:", await criacao.text());
      res.status(503).json({ error: "Não foi possível lembrar deste aparelho." });
      return;
    }

    const expira = calcularExpiracao(agora);
    res.setHeader("Set-Cookie", cabecalhoDeCookie(req, token, expira));
    // O token NAO volta no corpo: se voltasse, a pagina poderia guarda-lo e o
    // `HttpOnly` viraria enfeite.
    res.status(200).json({ lembrado: true, expiraEm: expira });
    return;
  }

  if (acao === "validar") {
    // Vem do cookie, nao do corpo: a pagina nao tem como ler nem forjar o valor.
    const token = lerCookieDeDispositivo(req);
    if (!token) {
      res.status(200).json({ confiavel: false, motivo: "desconhecido" });
      return;
    }

    const busca = await supabase(
      `${encodeURIComponent(TABELA_DISPOSITIVOS)}?token_hash=eq.${hashDoToken(token)}&select=*`,
    );
    const linhas = busca.ok ? ((await busca.json()) as LinhaDoBanco[]) : [];
    const linha = linhas[0] ?? null;

    // O registro tem de ser DESTE usuario. Sem esta checagem, um token valido de
    // outra conta dispensaria o desafio nesta — o token viraria um passe geral
    // em vez de uma credencial vinculada a uma pessoa.
    const doUsuario = linha && linha.user_id === auth.userId ? linha : null;
    const veredicto = avaliarDispositivo(doUsuario ? paraRegistro(doUsuario) : null, new Date());

    if (!veredicto.valido) {
      if (veredicto.motivo === "replay" && doUsuario) {
        console.warn("[dispositivo-confiavel] replay detectado; revogando todos do usuario");
        await revogarTudo(auth.userId);
      }
      res.status(200).json({ confiavel: false, motivo: veredicto.motivo });
      return;
    }

    // Rotaciona: o token usado morre e outro nasce. A linha antiga fica marcada
    // como `rotacionado_em` em vez de apagada, porque e ela que faz o replay ser
    // detectavel depois.
    const agora = new Date();
    const novoToken = randomBytes(BYTES_DO_TOKEN).toString("base64url");

    const marcar = await supabase(`${encodeURIComponent(TABELA_DISPOSITIVOS)}?id=eq.${doUsuario!.id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ rotacionado_em: agora.toISOString(), ultimo_uso_em: agora.toISOString() }),
    });

    if (!marcar.ok) {
      // Nao emite o novo token se nao conseguiu queimar o velho: os dois valendo
      // ao mesmo tempo e exatamente a situacao que a rotacao existe para evitar.
      console.error("[dispositivo-confiavel] falha ao rotacionar:", await marcar.text());
      res.status(200).json({ confiavel: false, motivo: "desconhecido" });
      return;
    }

    await supabase(encodeURIComponent(TABELA_DISPOSITIVOS), {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        user_id: auth.userId,
        token_hash: hashDoToken(novoToken),
        rotulo: doUsuario!.rotulo ?? rotularDispositivo(req.headers["user-agent"] ?? null),
        // O prazo conta a partir de agora: quem usa toda semana nunca expira.
        expira_em: calcularExpiracao(agora),
        ultimo_uso_em: agora.toISOString(),
      }),
    });

    const expira = calcularExpiracao(agora);
    res.setHeader("Set-Cookie", cabecalhoDeCookie(req, novoToken, expira));
    res.status(200).json({ confiavel: true, expiraEm: expira });
    return;
  }

  res.status(400).json({ error: "Ação desconhecida." });
}
