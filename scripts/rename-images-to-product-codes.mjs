/**
 * Renomeia as imagens do storage para o codigo do produto.
 *
 * Os arquivos foram enviados com `crypto.randomUUID()`, entao a loja inteira
 * aponta para nomes como `168a4c50-76b0-4bca-8bdc-27f693c4fa50-4x5.webp`. Nao da
 * para saber de que produto e um arquivo olhando o nome, e o envio em lote — que
 * casa arquivo com produto justamente pelo nome (`12336.jpg`) — nao reconhece o
 * que ja esta la.
 *
 * O alvo segue a mesma convencao do envio em lote:
 *
 *     12336.webp     capa
 *     12336_2.webp   segunda foto
 *     12336_3.webp   terceira
 *
 * **A ordem importa.** Move o arquivo primeiro e so entao grava a URL nova; se a
 * gravacao falhar, desfaz o move. O caminho contrario deixaria o banco apontando
 * para um arquivo que ainda nao existe, e a loja ficaria sem foto.
 *
 *   node scripts/rename-images-to-product-codes.mjs           # so mostra o plano
 *   node scripts/rename-images-to-product-codes.mjs --apply   # executa
 */
import { createClient } from "@supabase/supabase-js";

const BUCKET = "product-images";
const TABELA = "Clinic+ - Catálogo Front B2B";

const aplicar = process.argv.includes("--apply");

const url = process.env.VITE_SUPABASE_URL;
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !chave) {
  console.error("Faltam VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY. Rode com: node --env-file=.env");
  process.exit(1);
}

const sb = createClient(url, chave, { auth: { persistSession: false } });

/** Nome do objeto dentro do bucket, a partir da URL publica. */
function nomeDoObjeto(publicUrl) {
  if (typeof publicUrl !== "string") return null;
  const marca = `/${BUCKET}/`;
  const i = publicUrl.indexOf(marca);
  if (i === -1) return null;
  return decodeURIComponent(publicUrl.slice(i + marca.length).split("?")[0]);
}

function urlPublica(nome) {
  return sb.storage.from(BUCKET).getPublicUrl(nome).data.publicUrl;
}

function extensao(nome) {
  const ponto = nome.lastIndexOf(".");
  return ponto === -1 ? "webp" : nome.slice(ponto + 1).toLowerCase();
}

/**
 * Codigo utilizavel como nome de arquivo.
 *
 * Barra e espaco quebrariam o caminho dentro do bucket — viraria pasta, ou URL
 * com escape. Qualquer coisa fora de letra, numero, hifen e ponto vira hifen.
 */
function codigoSeguro(code) {
  return String(code ?? "")
    .trim()
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const { data: produtos, error } = await sb
  .from(TABELA)
  .select("id,product_code,name,image_url,image_urls");

if (error) {
  console.error("Nao foi possivel ler os produtos:", error.message);
  process.exit(1);
}

const planos = [];
const semCodigo = [];
const alvosUsados = new Set();

for (const produto of produtos) {
  const code = codigoSeguro(produto.product_code);
  const galeria = Array.isArray(produto.image_urls) ? produto.image_urls : [];

  // A capa vem primeiro e a galeria depois, sem repetir: e essa ordem que decide
  // qual arquivo fica com o nome limpo e quais ganham sufixo.
  const urls = [];
  for (const u of [produto.image_url, ...galeria]) {
    if (typeof u !== "string" || !u.trim()) continue;
    if (!urls.includes(u)) urls.push(u);
  }

  const doStorage = urls.filter((u) => nomeDoObjeto(u));
  if (doStorage.length === 0) continue;

  if (!code) {
    semCodigo.push({ id: produto.id, name: produto.name, arquivos: doStorage.length });
    continue;
  }

  const movimentos = [];
  doStorage.forEach((publicUrl, indice) => {
    const atual = nomeDoObjeto(publicUrl);
    const alvo = `${code}${indice === 0 ? "" : `_${indice + 1}`}.${extensao(atual)}`;

    if (alvosUsados.has(alvo) && atual !== alvo) {
      movimentos.push({ atual, alvo, publicUrl, conflito: true });
      return;
    }
    alvosUsados.add(alvo);
    if (atual !== alvo) movimentos.push({ atual, alvo, publicUrl, conflito: false });
  });

  if (movimentos.length > 0) {
    planos.push({ id: produto.id, code, name: produto.name, urls, movimentos });
  }
}

const totalMov = planos.reduce((n, p) => n + p.movimentos.length, 0);
const conflitos = planos.flatMap((p) => p.movimentos.filter((m) => m.conflito));

console.log(`produtos a renomear : ${planos.length}`);
console.log(`arquivos a mover    : ${totalMov}`);
if (semCodigo.length > 0) console.log(`sem codigo (pulados): ${semCodigo.length}`);
if (conflitos.length > 0) console.log(`CONFLITOS de nome   : ${conflitos.length} (serao pulados)`);

for (const plano of planos.slice(0, 5)) {
  console.log(`\n  ${plano.code} — ${plano.name}`);
  for (const m of plano.movimentos) console.log(`    ${m.atual}  ->  ${m.alvo}${m.conflito ? "  [CONFLITO]" : ""}`);
}
if (planos.length > 5) console.log(`\n  ... e mais ${planos.length - 5} produto(s)`);

if (!aplicar) {
  console.log("\nSimulacao. Rode com --apply para executar.");
  process.exit(0);
}

let movidos = 0;
let falhas = 0;

for (const plano of planos) {
  const feitos = [];
  let erro = null;

  for (const m of plano.movimentos) {
    if (m.conflito) continue;
    const { error: erroMove } = await sb.storage.from(BUCKET).move(m.atual, m.alvo);
    if (erroMove) {
      erro = `mover ${m.atual}: ${erroMove.message}`;
      break;
    }
    feitos.push(m);
  }

  if (!erro && feitos.length > 0) {
    const novas = plano.urls.map((u) => {
      const feito = feitos.find((m) => m.publicUrl === u);
      return feito ? urlPublica(feito.alvo) : u;
    });

    const { error: erroUpdate } = await sb
      .from(TABELA)
      .update({ image_url: novas[0], image_urls: novas })
      .eq("id", plano.id);

    if (erroUpdate) erro = `gravar produto ${plano.code}: ${erroUpdate.message}`;
  }

  if (erro) {
    // Desfaz o que ja tinha movido: melhor voltar ao estado anterior do que
    // deixar metade dos arquivos com nome novo e o banco apontando para o velho.
    for (const m of feitos) await sb.storage.from(BUCKET).move(m.alvo, m.atual);
    console.error(`  falhou: ${erro} (desfeito)`);
    falhas += 1;
  } else {
    movidos += feitos.length;
  }
}

console.log(`\narquivos renomeados: ${movidos}`);
if (falhas > 0) console.log(`produtos com falha : ${falhas}`);
