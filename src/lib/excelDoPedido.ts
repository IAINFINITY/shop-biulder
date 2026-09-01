import * as XLSX from "xlsx";

import { formatDocumentId, formatPhone } from "@/lib/brazilianIds";
import {
  formatOrderLineProductLabel,
  getOrderLinesGrandTotal,
  getOrderLinesQuantityTotal,
  parseOrderTableLines,
} from "@/lib/orders";
import type { OrderExportInput } from "@/lib/orderExportTypes";
import { rotuloDoStatus } from "@/lib/statusDoPedido";

/**
 * A planilha de um pedido.
 *
 * ## O que estava errado
 *
 * A versão anterior despejava tudo num `aoa_to_sheet` e parava aí. O resultado
 * abria com cinco defeitos, e nenhum era de conteúdo:
 *
 * 1. **Sem largura de coluna.** Toda coluna nascia com ~8 caracteres, então
 *    "5 ÓLEOS – Linhaça, Girassol, Cártamo…" aparecia como `#####` ou cortado, e
 *    o primeiro gesto de quem abria era arrastar cinco divisórias.
 * 2. **Dinheiro sem formato.** `16.24` cru, com ponto — que no Excel em
 *    português nem sempre é lido como número, e nunca parece dinheiro.
 * 3. **Cabeçalho de dados misturado com a tabela.** Os pares "Cliente / nome"
 *    ocupavam as colunas A e B, as mesmas onde a tabela abaixo põe código e
 *    produto: as duas coisas disputavam a mesma largura.
 * 4. **Totais desalinhados.** A quantidade caía na coluna C e o valor na E, com
 *    o rótulo em A — três células que não se leem como uma linha.
 * 5. **Sem painel congelado e sem filtro.** Rolar um pedido de 40 itens perdia
 *    o cabeçalho; ordenar por valor exigia selecionar a mão.
 *
 * ## O que dá para fazer, e o que não dá
 *
 * ⚠️ O `xlsx` livre (SheetJS CE, 0.18) **não escreve estilo de célula** —
 * negrito, fundo e borda são exclusividade da versão paga. Então nada aqui
 * tenta emular isso: o que sustenta a leitura é largura de coluna, formato de
 * número, painel congelado e filtro, que a versão livre escreve.
 *
 * Onde não dá para deixar bonito, deixa-se **correto**: número é número (não
 * texto), data é data, e a moeda tem formato de moeda. É o que faz a planilha
 * servir para somar, filtrar e girar numa dinâmica — que é a razão de alguém
 * pedir Excel em vez do PDF.
 */

/** `R$ 1.234,56` no Excel em português. O `_-` alinha positivos e negativos. */
const FORMATO_MOEDA = 'R$ #,##0.00';
const FORMATO_INTEIRO = "#,##0";

/** Larguras em caracteres. Medidas pelo conteúdo real, não chutadas. */
const LARGURAS = [
  { wch: 12 }, // Código
  { wch: 58 }, // Produto — nomes reais passam de 50 caracteres
  { wch: 10 }, // Quantidade
  { wch: 14 }, // Unitário
  { wch: 14 }, // Subtotal
];

type Celula = string | number | null;

function formatarData(valor: string): string {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(data);
}

export function montarPlanilhaDoPedido(order: OrderExportInput, numeroDoPedido: number): XLSX.WorkBook {
  const linhas = parseOrderTableLines(order.items, order.enrichmentMaps);
  const totalValor = getOrderLinesGrandTotal(linhas);
  const totalQuantidade = getOrderLinesQuantityTotal(linhas);

  const endereco = [
    [order.customer_address_street, order.customer_address_number].filter(Boolean).join(", "),
    order.customer_address_complement,
    order.customer_address_neighborhood,
    [order.customer_address_city, order.customer_address_state].filter(Boolean).join("/"),
    order.customer_address_cep,
  ]
    .filter(Boolean)
    .join(" · ");

  // O bloco de identificação usa **uma** coluna de rótulo e o valor ao lado; a
  // tabela começa depois de uma linha em branco. Antes os dois compartilhavam
  // as colunas A e B e brigavam pela mesma largura.
  const identificacao: Celula[][] = [
    [`PEDIDO Nº ${numeroDoPedido}`],
    [],
    ["Cliente", order.customer_name ?? ""],
    ["Empresa", order.customer_company ?? ""],
    ["CNPJ / CPF", order.customer_cnpj ? formatDocumentId(order.customer_cnpj) : ""],
    ["Telefone", order.customer_phone ? formatPhone(order.customer_phone) : ""],
    ["Emitido em", formatarData(order.created_at)],
    ["Estado", rotuloDoStatus(order.status ?? "")],
  ];

  if (endereco) identificacao.push(["Entrega", endereco]);
  if (order.customer_observation) identificacao.push(["Observação", order.customer_observation]);

  identificacao.push([]);

  /** Onde a tabela começa, base 0. É o que o congelamento e o filtro precisam. */
  const linhaDoCabecalho = identificacao.length;

  const grade: Celula[][] = [
    ...identificacao,
    ["Código", "Produto", "Quantidade", "Valor unitário", "Subtotal"],
    ...linhas.map((linha) => [
      linha.code,
      formatOrderLineProductLabel(linha),
      linha.quantity,
      linha.unitPrice,
      linha.subtotal,
    ]),
    // O total mora **na mesma linha e nas mesmas colunas** dos dados que soma.
    // Antes o rótulo ficava em A, a quantidade em C e o valor em E, em duas
    // linhas diferentes — três células soltas em vez de um fecho de tabela.
    ["", "Total do pedido", totalQuantidade, "", totalValor],
  ];

  const planilha = XLSX.utils.aoa_to_sheet(grade);
  const ultimaLinha = grade.length - 1;

  planilha["!cols"] = LARGURAS;

  // Congela tudo acima da primeira linha de dados: rolar um pedido de 40 itens
  // deixava de mostrar de quem ele era e o que cada coluna significava.
  planilha["!freeze"] = { xSplit: 0, ySplit: linhaDoCabecalho + 1, topLeftCell: `A${linhaDoCabecalho + 2}`, activePane: "bottomLeft", state: "frozen" };

  // Filtro no cabeçalho da tabela — ordenar por valor deixa de exigir seleção
  // manual, que é metade do motivo de alguém preferir Excel a PDF.
  planilha["!autofilter"] = {
    ref: XLSX.utils.encode_range(
      { r: linhaDoCabecalho, c: 0 },
      { r: ultimaLinha - 1, c: 4 },
    ),
  };

  // Formato de número, célula a célula.
  //
  // ⚠️ `z` só vale se a célula for **numérica** (`t: "n"`). Como os valores
  // entram como `number`, o `aoa_to_sheet` já as cria assim; formatar uma
  // célula de texto não faz nada e é o engano fácil aqui.
  for (let linha = linhaDoCabecalho + 1; linha <= ultimaLinha; linha += 1) {
    const quantidade = planilha[XLSX.utils.encode_cell({ r: linha, c: 2 })];
    if (quantidade?.t === "n") quantidade.z = FORMATO_INTEIRO;

    for (const coluna of [3, 4]) {
      const celula = planilha[XLSX.utils.encode_cell({ r: linha, c: coluna })];
      if (celula?.t === "n") celula.z = FORMATO_MOEDA;
    }
  }

  const arquivo = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(arquivo, planilha, "Pedido");
  return arquivo;
}
