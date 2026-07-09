import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { formatBRL } from "@/lib/formatMoney";
import {
  formatOrderLineProductLabel,
  getOrderLinesGrandTotal,
  getOrderLinesQuantityTotal,
  parseOrderTableLines,
  type OrderTableLine,
} from "@/lib/orders";
import {
  buildProxisImportFileContent,
  proxisImportFileName,
  type ProxisImportOrderInput,
} from "@/lib/proxisImportExport";
import { ensureProxisImportId } from "@/lib/proxisImportId";
import type { OrderExportInput } from "@/lib/orderExportTypes";

function orderFileBase(order: OrderExportInput): string {
  const date = new Date(order.created_at).toISOString().slice(0, 10);
  return `pedido-${order.id.slice(0, 8)}-${date}`;
}

function buildHeaderRows(order: OrderExportInput): (string | number)[][] {
  return [
    ["Pedido", order.id],
    ["Data", new Date(order.created_at).toLocaleString("pt-BR")],
    ["Cliente", order.customer_name],
    ["Empresa", order.customer_company],
    ["Telefone", order.customer_phone],
    ["CNPJ", order.customer_cnpj],
    ["Status", order.status],
    [],
  ];
}

function tableBodyRows(lines: OrderTableLine[]): (string | number)[][] {
  return lines.map((line) => [
    line.code,
    formatOrderLineProductLabel(line),
    line.quantity,
    line.unitPrice,
    line.subtotal,
  ]);
}

export function downloadOrderXlsx(order: OrderExportInput): void {
  const lines = parseOrderTableLines(order.items, order.enrichmentMaps);
  const totalValue = getOrderLinesGrandTotal(lines);
  const totalQuantity = getOrderLinesQuantityTotal(lines);

  const rows: (string | number)[][] = [
    ...buildHeaderRows(order),
    ["Código", "Produto", "Quantidade", "Valor unitário", "Subtotal"],
    ...tableBodyRows(lines),
    [],
    ["", "", "", "", ""],
    ["Total de quantidade de produtos", "", totalQuantity, "", ""],
    ["Total de valor", "", "", "", totalValue],
  ];

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Pedido");
  XLSX.writeFile(workbook, `${orderFileBase(order)}.xlsx`);
}

const PDF_PRIMARY: [number, number, number] = [200, 30, 30];
const PDF_MARGIN = 14;

function drawPdfOrderTotals(
  doc: jsPDF,
  startY: number,
  contentWidth: number,
  totalQuantity: number,
  totalValue: number,
): void {
  const boxY = startY + 6;
  const boxH = 18;
  const gap = 4;
  const boxW = (contentWidth - gap) / 2;

  const drawTotalBox = (x: number, label: string, value: string) => {
    doc.setFillColor(248, 249, 250);
    doc.setDrawColor(226, 230, 234);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, boxY, boxW, boxH, 2, 2, "FD");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(90, 90, 90);
    doc.text(label, x + 4, boxY + 7);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    doc.text(value, x + 4, boxY + 14);
  };

  drawTotalBox(PDF_MARGIN, "Total de quantidade de produtos", String(totalQuantity));
  drawTotalBox(PDF_MARGIN + boxW + gap, "Total de valor", formatBRL(totalValue));
}

export function downloadOrderPdf(order: OrderExportInput): void {
  const lines = parseOrderTableLines(order.items, order.enrichmentMaps);
  const totalValue = getOrderLinesGrandTotal(lines);
  const totalQuantity = getOrderLinesQuantityTotal(lines);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - PDF_MARGIN * 2;
  const colCode = 20;
  const colQty = 14;
  const colMoney = 28;
  const colProduct = contentWidth - colCode - colQty - colMoney * 2;

  let y = 16;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(...PDF_PRIMARY);
  doc.text("Pedido", PDF_MARGIN, y);

  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(55, 55, 55);

  const metaLines = [
    `Cliente: ${order.customer_name}`,
    `Empresa: ${order.customer_company}`,
    `Telefone: ${order.customer_phone}  ·  CNPJ: ${order.customer_cnpj}`,
    `Data: ${new Date(order.created_at).toLocaleString("pt-BR")}  ·  Status: ${order.status}`,
  ];
  for (const line of metaLines) {
    doc.text(line, PDF_MARGIN, y);
    y += 4.5;
  }

  y += 4;

  autoTable(doc, {
    startY: y,
    head: [["Código", "Produto", "Qtd", "Valor unit.", "Subtotal"]],
    body: lines.map((line) => [
      line.code,
      formatOrderLineProductLabel(line),
      String(line.quantity),
      formatBRL(line.unitPrice),
      formatBRL(line.subtotal),
    ]),
    styles: {
      fontSize: 8,
      cellPadding: { top: 2.5, right: 2, bottom: 2.5, left: 2 },
      lineColor: [230, 230, 230],
      lineWidth: 0.1,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      fillColor: PDF_PRIMARY,
      textColor: 255,
      fontStyle: "bold",
      halign: "center",
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: [252, 252, 252] },
    columnStyles: {
      0: { cellWidth: colCode, fontStyle: "bold", fontSize: 7 },
      1: { cellWidth: colProduct },
      2: { cellWidth: colQty, halign: "center" },
      3: { cellWidth: colMoney, halign: "right" },
      4: { cellWidth: colMoney, halign: "right", fontStyle: "bold" },
    },
    margin: { left: PDF_MARGIN, right: PDF_MARGIN },
    tableWidth: contentWidth,
  });

  const finalY =
    (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY ?? y + 20;
  drawPdfOrderTotals(doc, finalY, contentWidth, totalQuantity, totalValue);

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
    createdAt: order.created_at,
    items: order.items,
    enrichmentMaps: order.enrichmentMaps,
  };

  const content = buildProxisImportFileContent([input]);
  downloadTextFile(proxisImportFileName(proxisImportId, order.created_at), content);
  return proxisImportId;
}
