#!/usr/bin/env node
/**
 * Confere o `doc_marcador` dos pedidos que o catalogo mandou para o Proxis.
 *
 * ## Por que existe
 *
 * Em 25/08/2026 o responsavel pelo ERP avisou que o marcador `PEDIDO B2B`
 * quebrava os relatorios, e pediu o codigo `1726` no lugar. O valor mora em
 * `api/proxis-order.ts` (a variavel `PROXSIS_DOC_MARCADOR` nao existe na Vercel,
 * entao vale o padrao do codigo).
 *
 * O problema e que o marcador so aparece **depois** de um pedido de verdade
 * subir. Nao da para conferir olhando o deploy: e preciso ler de volta do ERP.
 * Este script faz isso — leitura pura, nao cria nem altera nada.
 *
 * ## Como usar
 *
 *   node scripts/conferir-marcador-proxis.mjs
 *
 * Le as credenciais do `.env`. Mostra os ultimos pedidos com `doc_ped_web`
 * (os que sairam do catalogo) e o marcador de cada um.
 */

import "dotenv/config";

const ESPERADO = (process.env.PROXSIS_DOC_MARCADOR ?? "").trim() || "1726";

const base = (process.env.PROXSIS_BASE_URL || "").replace(/\/$/, "");
const usuario = (process.env.PROXSIS_USER || "").trim();
const senha = (process.env.PROXSIS_PASSWORD || "").trim();
const filial = (process.env.PROXSIS_FILIAL || "").trim();

if (!base || !usuario || !senha) {
  console.error("Faltam PROXSIS_BASE_URL, PROXSIS_USER ou PROXSIS_PASSWORD no .env.");
  process.exit(1);
}

const cabecalhos = {
  "Content-Type": "application/json",
  Authorization: "Basic " + Buffer.from(`${usuario}:${senha}`).toString("base64"),
  "x-proManager-filial": filial,
  "X-ProManager-Pagina-Inicio": "0",
  "X-ProManager-Pagina-Quant": "50",
  // Sem o filtro vem qualquer pedido do ERP, inclusive de 2025 e de outros
  // canais. `doc_ped_web` so e preenchido pelo catalogo.
  "X-ProManager-Busca-Filtro": "doc_ped_web is not null",
};

// As aspas no nome do endpoint sao exigencia do ProManager, nao engano.
const resposta = await fetch(`${base}/"ObterPedidos"`, { method: "GET", headers: cabecalhos });

if (!resposta.ok) {
  console.error(`Proxis respondeu ${resposta.status}:`, (await resposta.text()).slice(0, 300));
  process.exit(1);
}

const corpo = await resposta.json();
const pedidos = (Array.isArray(corpo) ? corpo : [corpo])
  .filter((p) => p && p.doc_ped_web)
  .sort((a, b) => Number(b.doc_id) - Number(a.doc_id));

if (pedidos.length === 0) {
  console.log("Nenhum pedido do catalogo encontrado no Proxis.");
  process.exit(0);
}

console.log(`Marcador esperado: ${JSON.stringify(ESPERADO)}\n`);
console.log("doc_id   | emissao    | doc_ped_web        | doc_marcador");
console.log("---------|------------|--------------------|-------------");

for (const p of pedidos.slice(0, 15)) {
  const marcador = p.doc_marcador === null ? "(vazio)" : String(p.doc_marcador);
  const sinal = marcador === ESPERADO ? "OK " : "-- ";
  console.log(
    `${sinal}${String(p.doc_id).padEnd(6)} | ${String(p.doc_dt_emissao).slice(0, 10)} | ` +
      `${String(p.doc_ped_web).padEnd(18)} | ${marcador}`,
  );
}

const distintos = [...new Set(pedidos.map((p) => (p.doc_marcador === null ? "(vazio)" : String(p.doc_marcador))))];
const maisRecente = pedidos[0];
const marcadorRecente = maisRecente.doc_marcador === null ? "(vazio)" : String(maisRecente.doc_marcador);

console.log(`\nMarcadores distintos no historico: ${distintos.join(", ")}`);
console.log(`Pedido mais recente (${maisRecente.doc_ped_web}): ${marcadorRecente}`);

if (marcadorRecente === ESPERADO) {
  console.log("\nO ultimo pedido ja subiu com o marcador novo.");
} else {
  console.log(
    "\nO ultimo pedido ainda esta com o marcador antigo. Se ele e anterior ao deploy, e esperado:\n" +
      "o valor so muda em pedidos criados depois. Rode de novo apos o proximo pedido.",
  );
}
