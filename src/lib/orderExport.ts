// Só o `writeFile`: a montagem da planilha vive em `excelDoPedido.ts`, que
// entra por `await import` para não pesar em quem nunca exporta.
import * as XLSX from "xlsx";
import {
  buildProxisImportFileContent,
  foccoImportFileName,
  type ProxisImportOrderInput,
} from "@/lib/foccoImportExport";
import { ensureProxisImportId } from "@/lib/foccoImportId";
import type { OrderExportInput } from "@/lib/orderExportTypes";

function orderFileBase(order: OrderExportInput): string {
  const date = new Date(order.created_at).toISOString().slice(0, 10);
  return `pedido-${order.id.slice(0, 8)}-${date}`;
}

/**
 * Baixa a planilha do pedido.
 *
 * O conteudo mora em `excelDoPedido.ts`; aqui fica so o gesto de salvar. A
 * versao anterior montava a grade nesta funcao e nao configurava nada da
 * planilha — sem largura de coluna, sem formato de moeda, sem painel congelado
 * e com os totais em tres celulas soltas. Ver o cabecalho daquele arquivo.
 */
export async function downloadOrderXlsx(order: OrderExportInput): Promise<void> {
  const { montarPlanilhaDoPedido } = await import("@/lib/excelDoPedido");
  const numero = order.numeroDoPedido ?? order.proxis_import_id ?? 0;
  XLSX.writeFile(montarPlanilhaDoPedido(order, numero), `${orderFileBase(order)}.xlsx`);
}

/**
 * Baixa o PDF do pedido.
 *
 * O desenho mora em `pdfDoPedido.ts`; aqui fica só o gesto de salvar. A versao
 * anterior montava tudo nesta funcao — titulo, quatro linhas de texto corrido,
 * tabela e dois quadradinhos de total —, sem marca, sem rodape e sem numero de
 * pagina. Ver o cabecalho daquele arquivo para o que mudou e de onde veio.
 */
export async function downloadOrderPdf(order: OrderExportInput): Promise<void> {
  const { gerarPdfDoPedido } = await import("@/lib/pdfDoPedido");
  // Sem numero vindo da tela, cai no id de importacao e por fim em 0: o PDF
  // ainda sai, so que sem o numero que a lista mostra.
  const numero = order.numeroDoPedido ?? order.proxis_import_id ?? 0;
  const doc = await gerarPdfDoPedido(order, numero);
  doc.save(`${orderFileBase(order)}.pdf`);
}

function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function downloadProxisImportTxt(order: OrderExportInput): Promise<number> {
  const proxisImportId = await ensureProxisImportId(order.id, order.proxis_import_id);

  const input: ProxisImportOrderInput = {
    proxisImportId,
    customerCnpj: order.customer_cnpj,
    customerTprId: order.customer_tpr_id,
    createdAt: order.created_at,
    items: order.items,
    enrichmentMaps: order.enrichmentMaps,
  };

  const content = buildProxisImportFileContent([input]);
  downloadTextFile(foccoImportFileName(proxisImportId, order.created_at), content);
  return proxisImportId;
}
