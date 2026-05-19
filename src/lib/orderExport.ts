import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { formatBRL } from "@/lib/formatMoney";
import {
  formatOrderLineProductLabel,
  getOrderLinesGrandTotal,
  parseOrderTableLines,
  type OrderTableLine,
} from "@/lib/orders";
import type { OrderEnrichmentMaps } from "@/lib/products";

export type OrderExportInput = {
  id: string;
  created_at: string;
  customer_name: string;
  customer_company: string;
  customer_phone: string;
  customer_cnpj: string;
  status: string;
  items: unknown;
  enrichmentMaps?: OrderEnrichmentMaps;
};

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
  const total = getOrderLinesGrandTotal(lines);

  const rows: (string | number)[][] = [
    ...buildHeaderRows(order),
    ["Código", "Produto", "Quantidade", "Valor unitário", "Subtotal"],
    ...tableBodyRows(lines),
    [],
    ["", "", "", "Total", total],
  ];

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Pedido");
  XLSX.writeFile(workbook, `${orderFileBase(order)}.xlsx`);
}

export function downloadOrderPdf(order: OrderExportInput): void {
  const lines = parseOrderTableLines(order.items, order.enrichmentMaps);
  const total = getOrderLinesGrandTotal(lines);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  doc.setFontSize(16);
  doc.text("Pedido", 14, 18);
  doc.setFontSize(10);
  doc.text(`Cliente: ${order.customer_name}`, 14, 26);
  doc.text(`Empresa: ${order.customer_company}`, 14, 32);
  doc.text(`Telefone: ${order.customer_phone}  ·  CNPJ: ${order.customer_cnpj}`, 14, 38);
  doc.text(`Data: ${new Date(order.created_at).toLocaleString("pt-BR")}  ·  Status: ${order.status}`, 14, 44);

  autoTable(doc, {
    startY: 50,
    head: [["Código", "Produto", "Qtd", "Valor unit.", "Subtotal"]],
    body: lines.map((line) => [
      line.code,
      formatOrderLineProductLabel(line),
      String(line.quantity),
      formatBRL(line.unitPrice),
      formatBRL(line.subtotal),
    ]),
    foot: [["", "", "", "Total", formatBRL(total)]],
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [41, 128, 185], textColor: 255 },
    footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 72 },
      2: { cellWidth: 14, halign: "center" },
      3: { cellWidth: 28, halign: "right" },
      4: { cellWidth: 28, halign: "right" },
    },
    margin: { left: 14, right: 14 },
  });

  doc.save(`${orderFileBase(order)}.pdf`);
}
