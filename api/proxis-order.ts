import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAuth } from "./_auth.js";
import { aplicarRateLimit } from "./_rateLimit.js";

/**
 * A saída do pedido da plataforma. Hoje não há para onde mandar.
 *
 * ## Por que o arquivo continua existindo
 *
 * Em 31/08/2026 o Proxis saiu de uso. As 1.256 linhas que moravam aqui — buscar
 * o cliente no ERP, criar se não existisse, resolver endereço e município,
 * casar cada item, rodiziar representante, montar o documento, tentar de novo em
 * falha transitória — foram embora com ele.
 *
 * O que ficou é a **costura**: um lugar só por onde "o pedido sai da
 * plataforma". O responsável pelo ERP confirmou que virá outro sistema, e
 * ninguém sabe ainda qual. Quando ele chegar, é este arquivo que muda — não os
 * trinta que chamavam o antigo.
 *
 * Não é abstração antecipada: não há interface inventada aqui, nem adaptador
 * para um sistema que ninguém viu. É um endpoint que existe, autentica, e não
 * faz nada — o menor placeholder possível que preserva o ponto de extensão.
 *
 * ## Por que ainda responde 200
 *
 * Um navegador com o bundle antigo em cache continua chamando esta rota depois
 * do deploy. Devolver erro faria o checkout dele registrar falha para um pedido
 * que está perfeito — o pedido já foi gravado antes desta chamada, e sempre foi.
 * O 200 diz a verdade: não havia nada a fazer.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método não permitido." });
    return;
  }

  const auth = await requireAuth(req, res);
  if (!auth) return;

  if (!(await aplicarRateLimit(req, res, "proxis-order", auth.userId))) return;

  return res.status(200).json({
    ok: true,
    enviadoAoProxis: false,
    motivo: "integracao_desativada",
    detalhe: "O pedido fica na plataforma. Use os arquivos TXT, Excel ou PDF no painel.",
  });
}
