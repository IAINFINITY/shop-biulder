/**
 * Script de teste da integração Proxis.
 * Executa: node scripts/test-proxis.mjs
 *
 * Testa os 3 passos: buscar cliente, buscar produto, e (opcionalmente) criar pedido.
 */

import "dotenv/config";

const BASE_URL = process.env.PROXSIS_BASE_URL;
const USER = process.env.PROXSIS_USER;
const PASSWORD = process.env.PROXSIS_PASSWORD;
const FILIAL = process.env.PROXSIS_FILIAL || "2";

if (!BASE_URL || !USER || !PASSWORD) {
  console.error("❌ Variáveis PROXSIS_BASE_URL, PROXSIS_USER, PROXSIS_PASSWORD não encontradas no .env");
  process.exit(1);
}

console.log("=".repeat(60));
console.log("🔧 TESTE DE INTEGRAÇÃO PROXIS");
console.log("=".repeat(60));
console.log(`Base URL: ${BASE_URL}`);
console.log(`User: ${USER}`);
console.log(`Filial: ${FILIAL}`);
console.log("");

const authHeader = "Basic " + Buffer.from(`${USER}:${PASSWORD}`).toString("base64");

async function proxsisGet(endpoint, filtro) {
  const url = `${BASE_URL}/${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    Authorization: authHeader,
    "x-promanager-filial": FILIAL,
    "X-ProManager-Pagina-Inicio": "0",
    "X-ProManager-Pagina-Quant": "10",
  };
  if (filtro) headers["X-Promanager-Busca-Filtro"] = filtro;

  const res = await fetch(url, { method: "GET", headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  const text = await res.text();
  return text.trim() ? JSON.parse(text) : null;
}

// ============ TEST 1: Buscar produtos ============
console.log("─".repeat(60));
console.log("📦 TESTE 1: Listar produtos (ObterItens) - primeiros 5");
console.log("─".repeat(60));

try {
  const produtos = await proxsisGet("ObterItens");
  if (Array.isArray(produtos) && produtos.length > 0) {
    console.log(`✅ ${produtos.length} produto(s) encontrado(s)`);
    console.log("");
    console.log("Primeiros produtos:");
    for (const p of produtos.slice(0, 5)) {
      console.log(`   ite_id: ${p.ite_id} | ite_numero: ${p.ite_numero} | ${p.ite_descricao}`);
    }
  } else {
    console.log("⚠️  Nenhum produto retornado");
  }
} catch (err) {
  console.error("❌ Erro ao listar produtos:", err.message);
}

// ============ TEST 2: Buscar produto por número ============
console.log("");
console.log("─".repeat(60));
console.log("🔍 TESTE 2: Buscar produto por ite_numero");
console.log("─".repeat(60));

const TEST_PRODUCT_CODE = process.argv[2] || "7500";
console.log(`   Buscando product_code: ${TEST_PRODUCT_CODE}`);

try {
  const result = await proxsisGet("ObterItens", `item.ite_numero = '${TEST_PRODUCT_CODE}'`);
  if (Array.isArray(result) && result.length > 0) {
    const p = result[0];
    console.log(`✅ Encontrado! ite_id: ${p.ite_id} | ite_numero: ${p.ite_numero} | ${p.ite_descricao}`);
  } else if (result && result.ite_id) {
    console.log(`✅ Encontrado! ite_id: ${result.ite_id} | ${result.ite_descricao}`);
  } else {
    console.log(`⚠️  Produto com ite_numero '${TEST_PRODUCT_CODE}' não encontrado`);
  }
} catch (err) {
  console.error("❌ Erro ao buscar produto:", err.message);
}

// ============ TEST 3: Buscar cliente por CNPJ ============
console.log("");
console.log("─".repeat(60));
console.log("👤 TESTE 3: Buscar cliente por CNPJ");
console.log("─".repeat(60));

const TEST_CNPJ = process.argv[3] || "37.659.288/0001-10";
console.log(`   Buscando CNPJ: ${TEST_CNPJ}`);

try {
  const result = await proxsisGet("ObterParticipantes", `pes_cpf_cnpj = '${TEST_CNPJ}'`);
  if (Array.isArray(result) && result.length > 0) {
    const c = result[0];
    console.log(`✅ Encontrado! pes_id: ${c.pes_id} | ${c.pes_nome} | CNPJ: ${c.pes_cpf_cnpj}`);
    if (c.tabelapreco && c.tabelapreco.length > 0) {
      console.log(`   Tabela de preço: tpr_id = ${c.tabelapreco[0].tpr_id}`);
    }
  } else if (result && result.pes_id) {
    console.log(`✅ Encontrado! pes_id: ${result.pes_id} | ${result.pes_nome}`);
  } else {
    console.log(`⚠️  Cliente com CNPJ '${TEST_CNPJ}' não encontrado (será criado automaticamente no pedido)`);
  }
} catch (err) {
  console.error("❌ Erro ao buscar cliente:", err.message);
}

// ============ SUMMARY ============
console.log("");
console.log("=".repeat(60));
console.log("✅ Teste de conexão finalizado!");
console.log("");
console.log("Para testar a serverless function completa, instale o Vercel CLI:");
console.log("   npm i -g vercel");
console.log("   vercel dev");
console.log("");
console.log("Depois abra outra janela e rode:");
console.log('   curl -X POST http://localhost:3000/api/proxis-order \\');
console.log('     -H "Content-Type: application/json" \\');
console.log('     -d "{\\"customer_name\\":\\"Teste\\",\\"customer_cnpj\\":\\"37.659.288/0001-10\\",\\"customer_company\\":\\"Empresa Teste\\",\\"items\\":[{\\"product_code\\":\\"7500\\",\\"quantity\\":1,\\"unit_price\\":10,\\"name\\":\\"Produto Teste\\"}]}"');
console.log("=".repeat(60));
