/**
 * Teste COMPLETO do fluxo de pedido na Proxis.
 * Simula exatamente o que a serverless function faz.
 *
 * Executa: node scripts/test-pedido-completo.mjs
 *
 * ⚠️  ATENÇÃO: Este script CRIA UM PEDIDO REAL na Proxis!
 *     Use apenas para teste. Comente a seção 4 se quiser testar sem criar pedido.
 */
import "dotenv/config";

const BASE_URL = process.env.PROXSIS_BASE_URL;
const USER = process.env.PROXSIS_USER;
const PASSWORD = process.env.PROXSIS_PASSWORD;
const FILIAL = process.env.PROXSIS_FILIAL || "2";

const auth = "Basic " + Buffer.from(`${USER}:${PASSWORD}`).toString("base64");

function baseHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: auth,
    "x-promanager-filial": FILIAL,
  };
}

function formatCnpj(value) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 14) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  }
  return value.trim();
}

async function proxsisRequest(method, endpoint, { body, extraHeaders } = {}) {
  const url = `${BASE_URL}/${endpoint}`;
  const headers = { ...baseHeaders(), ...(extraHeaders || {}) };

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  const text = await res.text();
  return text.trim() ? JSON.parse(text) : null;
}

// =============== DADOS DO TESTE ===============
// Simula um pedido com dados fictícios
const TESTE = {
  customer_name: "Empresa Teste LTDA",
  customer_cnpj: "37.659.288/0001-10", // CNPJ que já existe na Proxis
  customer_company: "Empresa Teste LTDA",
  items: [
    { product_code: "7500", quantity: 2, unit_price: 45.90, name: "5 Mix Magnésios 90caps" },
  ],
};

console.log("=".repeat(60));
console.log("🧪 TESTE COMPLETO - FLUXO DE PEDIDO PROXIS");
console.log("=".repeat(60));
console.log("");
console.log("Dados do teste:");
console.log(`  Cliente: ${TESTE.customer_name}`);
console.log(`  CNPJ: ${TESTE.customer_cnpj}`);
console.log(`  Itens: ${TESTE.items.length}`);
console.log("");

// ===== PASSO 1: Buscar cliente por CNPJ =====
console.log("─".repeat(60));
console.log("👤 PASSO 1: Buscar cliente por CNPJ");
console.log("─".repeat(60));

let pesId = null;
let tprId = 1;

try {
  const filtro = `pes_cpf_cnpj = '${formatCnpj(TESTE.customer_cnpj)}'`;
  const result = await proxsisRequest("GET", "ObterParticipantes", {
    extraHeaders: {
      "X-ProManager-Pagina-Inicio": "0",
      "X-ProManager-Pagina-Quant": "5",
      "X-Promanager-Busca-Filtro": filtro,
    },
  });

  if (Array.isArray(result) && result.length > 0) {
    const cliente = result[0];
    pesId = cliente.pes_id;
    console.log(`✅ Cliente encontrado! pes_id: ${pesId} | ${cliente.pes_nome}`);

    if (cliente.tabelapreco && cliente.tabelapreco.length > 0) {
      tprId = cliente.tabelapreco[0].tpr_id;
      console.log(`   Tabela de preço: tpr_id = ${tprId}`);
    }
  } else {
    console.log("⚠️  Cliente não encontrado — seria criado automaticamente");
    console.log("   (Pulando criação neste teste para não poluir a base)");
  }
} catch (err) {
  console.error("❌ Erro:", err.message);
}

if (!pesId) {
  console.log("\n⛔ Sem pes_id, não é possível continuar o teste de pedido.");
  process.exit(0);
}

// ===== PASSO 2: Resolver produtos (product_code → ite_id) =====
console.log("");
console.log("─".repeat(60));
console.log("📦 PASSO 2: Resolver IDs dos produtos");
console.log("─".repeat(60));

const documentoItens = [];

for (const item of TESTE.items) {
  const filtro = `item.ite_numero = '${item.product_code}'`;
  try {
    const result = await proxsisRequest("GET", "ObterItens", {
      extraHeaders: {
        "X-ProManager-Pagina-Inicio": "0",
        "X-ProManager-Pagina-Quant": "5",
        "X-Promanager-Busca-Filtro": filtro,
      },
    });

    if (Array.isArray(result) && result.length > 0) {
      const produto = result[0];
      console.log(`✅ ${item.name} → ite_id: ${produto.ite_id} (ite_numero: ${produto.ite_numero})`);
      documentoItens.push({
        ite_id: produto.ite_id,
        dit_quantidade: item.quantity,
        dit_vlr_unitario: item.unit_price,
        lotes: [],
      });
    } else {
      console.log(`❌ Produto não encontrado: ${item.name} (code: ${item.product_code})`);
    }
  } catch (err) {
    console.error(`❌ Erro ao buscar ${item.product_code}:`, err.message);
  }
}

if (documentoItens.length === 0) {
  console.log("\n⛔ Nenhum produto resolvido. Abortando.");
  process.exit(0);
}

// ===== PASSO 3: Montar e exibir payload do pedido =====
console.log("");
console.log("─".repeat(60));
console.log("📋 PASSO 3: Payload do pedido montado");
console.log("─".repeat(60));

const now = new Date();
const docDtEmissao = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
const docPedWeb = `INFINITY-TESTE-${Date.now().toString(36).toUpperCase()}`;

const pedido = {
  doc_tipo: 2,
  oin_id: 1,
  tpr_id: tprId,
  cpa_id: 1,
  tti_id: 5,
  pes_id_cli: pesId,
  pes_id_ven: 1,
  doc_dt_emissao: docDtEmissao,
  doc_ped_web: docPedWeb,
  DocumentoItens: documentoItens,
};

console.log(JSON.stringify(pedido, null, 2));

// ===== PASSO 4: Criar pedido na Proxis =====
console.log("");
console.log("─".repeat(60));
console.log("🚀 PASSO 4: Criar pedido na Proxis (SalvarPedidoVenda)");
console.log("─".repeat(60));

// ⚠️ DESCOMENTE A LINHA ABAIXO PARA REALMENTE CRIAR O PEDIDO
// Comente novamente após testar para não criar pedidos duplicados.

const CRIAR_PEDIDO = process.argv.includes("--criar");

if (!CRIAR_PEDIDO) {
  console.log("");
  console.log("⏸️  Criação de pedido DESATIVADA (modo seguro).");
  console.log("   Para criar o pedido de verdade, rode:");
  console.log("");
  console.log("   node scripts/test-pedido-completo.mjs --criar");
  console.log("");
  console.log("✅ Todos os passos anteriores funcionaram! A integração está OK.");
} else {
  try {
    const resultado = await proxsisRequest("POST", '"SalvarPedidoVenda"', { body: pedido });
    console.log("✅ PEDIDO CRIADO COM SUCESSO!");
    console.log(`   doc_ped_web: ${docPedWeb}`);
    console.log("   Resposta:", JSON.stringify(resultado, null, 2));
  } catch (err) {
    console.error("❌ Erro ao criar pedido:", err.message);
  }
}

console.log("");
console.log("=".repeat(60));
