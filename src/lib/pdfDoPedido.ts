import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import logoClinicMais from "@/assets/clinicmais-logo.png";
import { INTER_REGULAR, INTER_SEMIBOLD } from "@/assets/fontes/interParaPdf";
import { formatDocumentId, formatPhone } from "@/lib/brazilianIds";
import { formatBRL } from "@/lib/formatMoney";
import {
  formatOrderLineProductLabel,
  getOrderLinesGrandTotal,
  getOrderLinesQuantityTotal,
  parseOrderTableLines,
} from "@/lib/orders";
import type { OrderExportInput } from "@/lib/orderExportTypes";
import { rotuloDoStatus } from "@/lib/statusDoPedido";

/**
 * O PDF de um pedido.
 *
 * ## As medidas vieram de pesquisa, não de olho
 *
 * A primeira versão foi desenhada por semelhança com o relatório de outro
 * projeto, e encolhi tudo pelo caminho. Levantando o que o mercado usa para
 * pedido de compra e nota, três decisões minhas estavam **fora da faixa
 * recomendada** — e todas no mesmo sentido, o de apertar:
 *
 * | | recomendado | eu tinha |
 * |---|---|---|
 * | corpo da tabela | 10–12pt, **nunca abaixo de 10** | 8pt |
 * | letra miúda (rótulo, rodapé) | 8–10pt, mínimo 8 | 6.5pt |
 * | totais e datas | 12–14pt | 9pt |
 * | título do documento | 14–18pt | 15pt ✓ |
 * | margem | mínimo 12,7mm; 25mm é o padrão | 14mm |
 * | entre seções | 10–16mm | ~7mm |
 *
 * Fonte abaixo de 10pt num documento que vai ser impresso e conferido à mão é
 * o erro que as referências marcam como o mais comum. A escala em `FONTE`
 * respeita os pisos.
 *
 * ## ⚠️ É um documento interno, e isso muda a lista de campos
 *
 * As referências de pedido de compra pedem condições de pagamento, contato para
 * dúvidas, dados cadastrais da vendedora e data prevista de entrega — porque
 * pressupõem um papel que **sai da empresa** e vira acordo com um fornecedor.
 *
 * Este não sai: fica com a administração, para conferir o que foi pedido. Uma
 * seção de condições explicando ao próprio time quando se paga é ruído, e foi
 * removida. O que fica é o que responde às perguntas de conferência: quem
 * pediu, para onde vai, o que tem dentro, e quanto dá.
 *
 * O que continua valendo da lista canônica: número único, data, dados de quem
 * comprou, endereço de entrega, linhas com código, descrição, quantidade,
 * unitário e subtotal, totais, e "página X de Y" em documento de mais de uma
 * folha.
 *
 * ## Estrutura
 *
 * A ossatura veio de `integracao_fundos_hollytech`
 * (`src/lib/relatorios/pdf-fechamento.ts`): marca no topo, filete da cor da
 * empresa, indicadores em cartões, seções numeradas, tabela com filete no lugar
 * de zebra, rodapé fixo em todas as páginas.
 *
 * ⚠️ **Estrutura, não biblioteca.** Lá é `pdfkit` no servidor; aqui é `jsPDF` no
 * navegador, que já é dependência. A outra referência (`gardner_prova`)
 * rasteriza a tela com `html2canvas` — o PDF vira foto: texto não selecionável,
 * não pesquisável, pesado. Para um pedido de onde se copia código de produto,
 * vetorial ganha.
 *
 * ## Unidade: milímetros para posição, pontos para fonte
 *
 * jsPDF em `mm` (A4 = 210×297), mas `setFontSize` é sempre em pontos. Misturar
 * os dois é o engano fácil aqui.
 */

/** Paleta do painel. Os tokens do CSS são HSL; aqui vão em RGB, que é o que o jsPDF lê. */
const COR = {
  primaria: [175, 20, 33] as [number, number, number], // --primary  359 80% 38%
  texto: [24, 28, 36] as [number, number, number],
  suave: [104, 113, 129] as [number, number, number],
  borda: [225, 228, 234] as [number, number, number],
  bordaForte: [200, 206, 215] as [number, number, number],
  fundoSuave: [246, 247, 249] as [number, number, number],
};

/**
 * A escala tipográfica, em pontos.
 *
 * Num lugar só: era assim que `6.5` aparecia em cinco chamadas e ninguém
 * percebia que o documento inteiro tinha ficado abaixo do piso legível.
 */
const FONTE = {
  /** Nome do cliente no topo. Faixa de título: 14–18pt. */
  titulo: 16,
  /** "PEDIDO Nº 35" e os títulos de seção. */
  destaque: 11,
  /** Números dos cartões e o total: "detalhe importante", 12–14pt. */
  numero: 15,
  /** Corpo da tabela e valores de campo. **Piso de 10pt.** */
  corpo: 10,
  /** Cabeçalho da tabela. */
  cabecalhoDaTabela: 8.5,
  /** Rótulos e rodapé — letra miúda, piso de 8pt. */
  miuda: 8,
};

/** 16mm: acima do mínimo de 12,7mm, abaixo do 1" clássico que roubaria a tabela. */
const PAGINA = { largura: 210, altura: 297, margem: 16 };
const CONTEUDO = PAGINA.largura - PAGINA.margem * 2;

/** Respiro entre seções. As referências pedem 10–16mm; eu tinha ~7. */
const ENTRE_SECOES = 11;

/** Proporção real do arquivo: 513×149. Deformar a marca é pior que não tê-la. */
const LOGO = { largura: 46, altura: 46 * (149 / 513) };

/**
 * Dados cadastrais do rodapé.
 *
 * Enxutos de propósito: **este documento não sai da administração**. CNPJ e
 * endereço da vendedora seriam obrigatórios num pedido que vai ao fornecedor;
 * num papel de conferência interna, seriam três linhas que ninguém lê.
 */
const EMPRESA = {
  nome: "Clinic+ Suplementos e Nutrição",
  site: "catalogo-clinicmais.iainfinity.com.br",
};

/**
 * A fonte do documento.
 *
 * ## Por que embutir, em vez de usar a Helvetica do jsPDF
 *
 * "helvetica" é uma das 14 fontes que todo leitor de PDF tem — e que por isso
 * **não vão dentro do arquivo**. Cada leitor substitui pela que tiver à mão:
 * Helvetica no Mac, Arial no Windows, Liberation Sans no Linux. O documento
 * muda de cara conforme quem abre, e a versão aprovada não é a que sai
 * impressa. Num formato cujo propósito é travar o layout, deixar a fonte solta
 * contradiz o formato.
 *
 * Embutida, a Inter — **a mesma do painel**, em `tailwind.config.ts` — o papel
 * e a tela passam a falar a mesma língua, e o arquivo abre igual em todo lugar.
 *
 * ## Custa 46 KB, e não 600
 *
 * A Inter inteira passa de 300 KB por peso. `scripts/gerar-fontes-do-pdf.py`
 * instancia os dois pesos da variável e **recorta** para os caracteres que este
 * documento usa: 23 KB cada. E tudo isto entra por `await import`, então quem
 * nunca baixa um PDF não paga nada.
 */
const FAMILIA = "Inter";

function registrarFonte(doc: jsPDF): void {
  doc.addFileToVFS("Inter-Regular.ttf", INTER_REGULAR);
  doc.addFont("Inter-Regular.ttf", FAMILIA, "normal");
  // SemiBold (600) no lugar de Bold (700): a Inter em 700 fica pesada demais
  // para corpo de documento, e 600 é o peso que o painel usa nos títulos.
  doc.addFileToVFS("Inter-SemiBold.ttf", INTER_SEMIBOLD);
  doc.addFont("Inter-SemiBold.ttf", FAMILIA, "bold");
}

function formatarDataHora(valor: string): string {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(data);
}

/** Depois disto, o PDF sai sem a marca. Ver `carregarLogo`. */
const ESPERA_PELA_LOGO_MS = 3000;

/**
 * A marca, convertida para um PNG que o jsPDF entenda.
 *
 * ## ⚠️ O arquivo se chama `.png` e **é WebP**
 *
 * `src/assets/clinicmais-logo.png` começa com `RIFF....WEBP`. O navegador exibe
 * sem reclamar — WebP é suportado —, então a tela sempre pareceu certa. O jsPDF
 * é que lê os **bytes** e, mandado tratá-los como PNG, produz lixo: foi a mancha
 * preta que apareceu no lugar da logo.
 *
 * A saída é não confiar no formato de origem: desenhar num `<canvas>` e pedir
 * `toDataURL("image/png")`. O navegador decodifica o que for (WebP, PNG
 * indexado, JPEG) e devolve um PNG cru. Renomear o arquivo resolveria só este
 * caso; isto resolve o próximo também.
 *
 * O fundo branco é de propósito: PNG com transparência vira fundo **preto** no
 * PDF, que é o mesmo defeito por outro caminho.
 */
export function carregarLogo(): Promise<string | null> {
  return new Promise((resolve) => {
    let resolvido = false;
    const encerrar = (valor: string | null) => {
      if (resolvido) return;
      resolvido = true;
      window.clearTimeout(prazo);
      resolve(valor);
    };

    // `onload` e `onerror` cobrem sucesso e falha, mas não o terceiro caso: a
    // imagem que nunca resolve nem falha. Sem teto, o clique em "PDF" ficaria
    // pendurado para sempre sem baixar nada e sem explicar por quê.
    const prazo = window.setTimeout(() => encerrar(null), ESPERA_PELA_LOGO_MS);

    const imagem = new Image();

    imagem.onload = () => {
      try {
        const tela = document.createElement("canvas");
        tela.width = imagem.naturalWidth || 513;
        tela.height = imagem.naturalHeight || 149;

        const pincel = tela.getContext("2d");
        // Sem canvas (jsdom nos testes, navegador com canvas bloqueado) o PDF
        // sai sem a marca em vez de não sair.
        if (!pincel) return encerrar(null);

        pincel.fillStyle = "#FFFFFF";
        pincel.fillRect(0, 0, tela.width, tela.height);
        pincel.drawImage(imagem, 0, 0);

        encerrar(tela.toDataURL("image/png"));
      } catch {
        encerrar(null);
      }
    };

    imagem.onerror = () => encerrar(null);
    imagem.src = logoClinicMais;
  });
}

function desenharCabecalho(doc: jsPDF, logo: string | null, numero: number): number {
  const topo = PAGINA.margem;

  if (logo) {
    doc.addImage(logo, "PNG", PAGINA.margem, topo, LOGO.largura, LOGO.altura);
  } else {
    doc.setFont(FAMILIA, "bold").setFontSize(FONTE.titulo).setTextColor(...COR.primaria);
    doc.text("Clinic+", PAGINA.margem, topo + 8);
  }

  doc.setFont(FAMILIA, "bold").setFontSize(FONTE.destaque).setTextColor(...COR.primaria);
  doc.text(`PEDIDO Nº ${numero}`, PAGINA.largura - PAGINA.margem, topo + 5, { align: "right" });
  doc.setFont(FAMILIA, "normal").setFontSize(FONTE.miuda).setTextColor(...COR.suave);
  doc.text("Documento gerado pelo catálogo B2B", PAGINA.largura - PAGINA.margem, topo + 10, { align: "right" });

  const linha = topo + 15;
  doc.setDrawColor(...COR.primaria).setLineWidth(0.7);
  doc.line(PAGINA.margem, linha, PAGINA.largura - PAGINA.margem, linha);

  return linha + 10;
}

function desenharIdentificacao(doc: jsPDF, order: OrderExportInput, y: number): number {
  const titulo = order.customer_company?.trim() || order.customer_name?.trim() || "Pedido";

  // O selo primeiro: ele define quanta largura sobra para o nome, e nome longo
  // ("AGROINDUSTRIA DE ERVA MATE SIGNOR LTDA") passava por baixo dele.
  const rotulo = rotuloDoStatus(order.status ?? "");
  doc.setFont(FAMILIA, "bold").setFontSize(FONTE.miuda);
  const larguraSelo = doc.getTextWidth(rotulo) + 9;
  const xSelo = PAGINA.largura - PAGINA.margem - larguraSelo;
  doc.setFillColor(...COR.primaria).roundedRect(xSelo, y - 5, larguraSelo, 7.5, 3.75, 3.75, "F");
  doc.setTextColor(255, 255, 255).text(rotulo, xSelo + larguraSelo / 2, y + 0.2, { align: "center" });

  doc.setFont(FAMILIA, "bold").setFontSize(FONTE.titulo).setTextColor(...COR.texto);
  doc.text(titulo, PAGINA.margem, y, { maxWidth: CONTEUDO - larguraSelo - 6 });

  doc.setFont(FAMILIA, "normal").setFontSize(FONTE.corpo).setTextColor(...COR.suave);
  doc.text(`Emitido em ${formatarDataHora(order.created_at)}`, PAGINA.margem, y + 6.5);

  return y + ENTRE_SECOES + 4;
}

/** Os três números do topo. "Detalhe importante" pede 12–14pt; aqui vão 15. */
function desenharIndicadores(doc: jsPDF, y: number, itens: number, unidades: number, total: number): number {
  const cartoes = [
    { rotulo: "ITENS DISTINTOS", valor: String(itens) },
    { rotulo: "UNIDADES", valor: String(unidades) },
    { rotulo: "TOTAL DO PEDIDO (BRL)", valor: formatBRL(total) },
  ];

  const espaco = 4;
  const largura = (CONTEUDO - espaco * (cartoes.length - 1)) / cartoes.length;
  const altura = 24;

  cartoes.forEach((cartao, indice) => {
    const x = PAGINA.margem + indice * (largura + espaco);
    doc.setFillColor(...COR.fundoSuave).rect(x, y, largura, altura, "F");
    doc.setDrawColor(...COR.borda).setLineWidth(0.2).rect(x, y, largura, altura, "S");
    // Filete da marca no topo do cartão — o mesmo gesto da referência.
    doc.setFillColor(...COR.primaria).rect(x, y, largura, 0.9, "F");

    doc.setFont(FAMILIA, "bold").setFontSize(FONTE.miuda).setTextColor(...COR.suave);
    doc.text(cartao.rotulo, x + 5, y + 8.5);
    doc.setFont(FAMILIA, "bold").setFontSize(FONTE.numero).setTextColor(...COR.texto);
    doc.text(cartao.valor, x + 5, y + 18);
  });

  return y + altura + ENTRE_SECOES;
}

/** Nível 1: numerada, com o número na cor da marca. */
function desenharSecao(doc: jsPDF, numero: number, titulo: string, y: number): number {
  doc.setFont(FAMILIA, "bold").setFontSize(FONTE.destaque).setTextColor(...COR.primaria);
  doc.text(String(numero).padStart(2, "0"), PAGINA.margem, y);
  doc.setFont(FAMILIA, "bold").setFontSize(FONTE.destaque).setTextColor(...COR.texto);
  doc.text(titulo.toUpperCase(), PAGINA.margem + 9, y, { charSpace: 0.2 });

  doc.setDrawColor(...COR.bordaForte).setLineWidth(0.3);
  doc.line(PAGINA.margem, y + 3, PAGINA.largura - PAGINA.margem, y + 3);

  return y + 9;
}

/**
 * Um bloco de rótulo/valor empilhado, numa coluna.
 *
 * Devolve a altura que ocupou — é isso que permite pôr dois lado a lado e saber
 * onde continuar depois do mais alto dos dois.
 */
function desenharColunaDeCampos(
  doc: jsPDF,
  campos: { rotulo: string; valor: string }[],
  x: number,
  y: number,
  largura: number,
): number {
  let altura = 0;

  for (const campo of campos) {
    doc.setFont(FAMILIA, "normal").setFontSize(FONTE.miuda).setTextColor(...COR.suave);
    doc.text(campo.rotulo.toUpperCase(), x, y + altura);

    doc.setFont(FAMILIA, "normal").setFontSize(FONTE.corpo).setTextColor(...COR.texto);
    // Valor longo (razão social, endereço) quebra em vez de invadir a coluna
    // vizinha — e a altura acompanha, senão o campo seguinte escreve por cima.
    const linhas = doc.splitTextToSize(campo.valor || "—", largura - 4) as string[];
    doc.text(linhas, x, y + altura + 4.6);

    altura += 4.6 + linhas.length * 4.2 + 3.4;
  }

  return altura;
}

/**
 * "Quem pediu" e "Entrega", lado a lado.
 *
 * ## Por que lado a lado, e não uma seção embaixo da outra
 *
 * É o par "bill to / ship to" que toda nota usa, e aqui ele resolve um problema
 * medido: empilhadas, as duas seções gastavam **187mm antes da primeira linha
 * da tabela** — 63% da folha em preâmbulo, e só três ou quatro itens cabiam na
 * página 1. Lado a lado, a tabela começa por volta dos 145mm.
 *
 * E são a mesma pergunta em duas metades: "de quem é" e "para onde vai". Quem
 * confere um pedido lê as duas juntas.
 */
function desenharQuemEEntrega(
  doc: jsPDF,
  esquerda: { rotulo: string; valor: string }[],
  direita: { rotulo: string; valor: string }[] | null,
  y: number,
): number {
  const espaco = 10;
  const largura = direita ? (CONTEUDO - espaco) / 2 : CONTEUDO;
  const xDireita = PAGINA.margem + largura + espaco;

  doc.setFont(FAMILIA, "bold").setFontSize(FONTE.destaque).setTextColor(...COR.primaria);
  doc.text("01", PAGINA.margem, y);
  doc.setFont(FAMILIA, "bold").setFontSize(FONTE.destaque).setTextColor(...COR.texto);
  doc.text("QUEM PEDIU", PAGINA.margem + 9, y, { charSpace: 0.2 });

  if (direita) {
    doc.setFont(FAMILIA, "bold").setFontSize(FONTE.destaque).setTextColor(...COR.primaria);
    doc.text("02", xDireita, y);
    doc.setFont(FAMILIA, "bold").setFontSize(FONTE.destaque).setTextColor(...COR.texto);
    doc.text("ENTREGA", xDireita + 9, y, { charSpace: 0.2 });
  }

  doc.setDrawColor(...COR.bordaForte).setLineWidth(0.3);
  doc.line(PAGINA.margem, y + 3, PAGINA.margem + largura, y + 3);
  if (direita) doc.line(xDireita, y + 3, xDireita + largura, y + 3);

  const topo = y + 9;
  const alturaEsquerda = desenharColunaDeCampos(doc, esquerda, PAGINA.margem, topo, largura);
  const alturaDireita = direita ? desenharColunaDeCampos(doc, direita, xDireita, topo, largura) : 0;

  return topo + Math.max(alturaEsquerda, alturaDireita) + ENTRE_SECOES - 4;
}

/**
 * O rodapé, em **todas** as páginas.
 *
 * ⚠️ Só pode ser desenhado no fim, quando o total de páginas já é conhecido —
 * daí percorrer as páginas prontas em vez de escrever junto com cada uma. Um
 * pedido de quatro páginas saía com as três últimas sem identificação nenhuma:
 * soltas, não davam para saber de qual pedido eram. "Página X de Y" em pedido
 * de mais de uma folha é item de checklist nas referências, e por isso: é o que
 * denuncia a folha que se perdeu no caminho.
 */
function desenharRodape(doc: jsPDF, numero: number, geradoEm: string): void {
  const total = doc.getNumberOfPages();

  for (let pagina = 1; pagina <= total; pagina += 1) {
    doc.setPage(pagina);
    const y = PAGINA.altura - PAGINA.margem;

    doc.setDrawColor(...COR.borda).setLineWidth(0.2);
    doc.line(PAGINA.margem, y - 7, PAGINA.largura - PAGINA.margem, y - 7);

    doc.setFont(FAMILIA, "bold").setFontSize(FONTE.miuda).setTextColor(...COR.suave);
    doc.text(EMPRESA.nome, PAGINA.margem, y - 2.5);
    doc.setFont(FAMILIA, "normal").setFontSize(FONTE.miuda);
    doc.text(`${EMPRESA.site}  ·  Pedido nº ${numero}  ·  Gerado em ${geradoEm}`, PAGINA.margem, y + 1.5);

    doc.setFont(FAMILIA, "bold").setFontSize(FONTE.miuda);
    doc.text(`Página ${pagina} de ${total}`, PAGINA.largura - PAGINA.margem, y - 0.5, { align: "right" });
  }
}

/**
 * Monta o PDF do pedido.
 *
 * É `async` porque a marca precisa carregar antes de ser desenhada. Quem chama
 * já estava num `await import(...)`, então não custou nada a mais.
 */
export async function gerarPdfDoPedido(order: OrderExportInput, numeroDoPedido: number): Promise<jsPDF> {
  const linhas = parseOrderTableLines(order.items, order.enrichmentMaps);
  const totalValor = getOrderLinesGrandTotal(linhas);
  const totalQuantidade = getOrderLinesQuantityTotal(linhas);

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  registrarFonte(doc);
  doc.setProperties({
    title: `Pedido nº ${numeroDoPedido} — ${order.customer_company || order.customer_name}`,
    subject: "Pedido do catálogo B2B Clinic+",
    author: EMPRESA.nome,
  });

  const logo = await carregarLogo();

  let y = desenharCabecalho(doc, logo, numeroDoPedido);
  y = desenharIdentificacao(doc, order, y);
  y = desenharIndicadores(doc, y, linhas.length, totalQuantidade, totalValor);

  const enderecoLinha = [order.customer_address_street, order.customer_address_number].filter(Boolean).join(", ");
  const cidadeLinha = [order.customer_address_city, order.customer_address_state].filter(Boolean).join("/");
  const temEndereco = Boolean(enderecoLinha || cidadeLinha || order.customer_address_cep);

  y = desenharQuemEEntrega(
    doc,
    [
      { rotulo: "Nome", valor: order.customer_name ?? "" },
      { rotulo: "Empresa", valor: order.customer_company ?? "" },
      { rotulo: "CNPJ / CPF", valor: order.customer_cnpj ? formatDocumentId(order.customer_cnpj) : "" },
      { rotulo: "Telefone", valor: order.customer_phone ? formatPhone(order.customer_phone) : "" },
    ],
    temEndereco
      ? [
          {
            rotulo: "Endereço",
            valor: [enderecoLinha, order.customer_address_complement, order.customer_address_neighborhood]
              .filter(Boolean)
              .join(" · "),
          },
          { rotulo: "Cidade / UF", valor: cidadeLinha },
          { rotulo: "CEP", valor: order.customer_address_cep ?? "" },
          { rotulo: "Observação do cliente", valor: order.customer_observation ?? "" },
        ]
      : null,
    y,
  );

  y = desenharSecao(doc, temEndereco ? 3 : 2, `Itens (${linhas.length})`, y);

  const colCodigo = 22;
  const colQtd = 16;
  const colDinheiro = 28;
  const colProduto = CONTEUDO - colCodigo - colQtd - colDinheiro * 2;

  autoTable(doc, {
    startY: y,
    head: [["Código", "Produto", "Qtd", "Unitário", "Subtotal"]],
    body: linhas.map((linha) => [
      linha.code,
      formatOrderLineProductLabel(linha),
      String(linha.quantity),
      formatBRL(linha.unitPrice),
      formatBRL(linha.subtotal),
    ]),
    foot: [["", "Total do pedido", String(totalQuantidade), "", formatBRL(totalValor)]],
    styles: {
      font: FAMILIA,
      // ⚠️ 10pt é o **piso** para corpo de documento impresso, e estava em 8.
      fontSize: FONTE.corpo,
      cellPadding: { top: 3, right: 2.5, bottom: 3, left: 2.5 },
      lineColor: COR.borda,
      lineWidth: { top: 0, right: 0, bottom: 0.1, left: 0 },
      overflow: "linebreak",
      valign: "middle",
      textColor: COR.texto,
    },
    // ⚠️ Cabeçalho cinza com letra escura, e não a faixa vermelha original.
    // Vermelho sólido atravessando a folha competia com a marca do topo e com o
    // selo de estado: três vermelhos disputando na mesma página.
    headStyles: {
      fillColor: COR.borda,
      textColor: COR.texto,
      fontStyle: "bold",
      fontSize: FONTE.cabecalhoDaTabela,
      cellPadding: { top: 3, right: 2.5, bottom: 3, left: 2.5 },
      lineColor: COR.bordaForte,
      lineWidth: { top: 0, right: 0, bottom: 0.3, left: 0 },
    },
    footStyles: {
      fillColor: [255, 255, 255],
      textColor: COR.texto,
      fontStyle: "bold",
      fontSize: FONTE.destaque,
      lineColor: COR.bordaForte,
      lineWidth: { top: 0.4, right: 0, bottom: 0, left: 0 },
    },
    // Sem zebra: o filete fino separa igual e não inventa um cinza fora da
    // paleta. A quebra de página do autoTable já repete o cabeçalho e nunca
    // parte uma linha ao meio — que é o que as referências pedem para pedido de
    // várias folhas.
    columnStyles: {
      0: { cellWidth: colCodigo, fontStyle: "bold", fontSize: FONTE.cabecalhoDaTabela, textColor: COR.suave },
      1: { cellWidth: colProduto },
      2: { cellWidth: colQtd, halign: "center" },
      3: { cellWidth: colDinheiro, halign: "right" },
      4: { cellWidth: colDinheiro, halign: "right", fontStyle: "bold" },
    },
    margin: { left: PAGINA.margem, right: PAGINA.margem, top: PAGINA.margem + 8, bottom: PAGINA.margem + 12 },
    tableWidth: CONTEUDO,
  });

  desenharRodape(doc, numeroDoPedido, formatarDataHora(new Date().toISOString()));
  return doc;
}
