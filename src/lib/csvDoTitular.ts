/**
 * O pacote do titular em CSV — uma planilha por seção.
 *
 * ## Por que CSV, e por que não só JSON
 *
 * O art. 20 do RGPD e o art. 18, V da LGPD pedem formato "estruturado, de uso
 * comum e leitura automática". Nem a LGPD nem a ANPD fixaram um formato: o art.
 * 40 permite que a autoridade estabeleça padrões de interoperabilidade, e até
 * hoje ela não estabeleceu. As diretrizes europeias (WP242 rev.01) citam **CSV,
 * XML e JSON** como exemplos válidos, e recusam explicitamente PDF digitalizado
 * e formato proprietário.
 *
 * Ou seja: JSON já cumpria a lei. O que ele não cumpria era o pedido de quem usa
 * — "quero só meus endereços" abria um arquivo com sete seções aninhadas, que
 * não entra numa planilha. CSV é achatado e abre em qualquer lugar; JSON guarda
 * o aninhamento. Os dois ficam, e cada um faz o que sabe:
 *
 * | quero                       | formato |
 * |-----------------------------|---------|
 * | uma seção, para conferir    | CSV     |
 * | tudo, para levar embora     | JSON    |
 *
 * ⚠️ **PDF não entra**, por mais que fosse o mais bonito de entregar: as
 * diretrizes o tratam como o exemplo do que *não* é leitura automática. Ele
 * serviria ao direito de acesso (art. 18, II) e não ao de portabilidade.
 *
 * ## As decisões de formato que não são óbvias
 *
 * **Separador `;` e não vírgula.** O Excel em português usa o separador de lista
 * do sistema, que aqui é `;`. Com vírgula a planilha inteira cai numa coluna só
 * — o arquivo estaria tecnicamente certo e inútil na prática. O RFC 4180 fala em
 * vírgula, mas ele descreve o `text/csv`, não o que o Excel brasileiro abre.
 *
 * **Número com vírgula decimal.** Pelo mesmo motivo: `24.99` vira texto numa
 * planilha pt-BR, `24,99` vira número. Como o separador de coluna é `;`, não há
 * ambiguidade.
 *
 * **Data em dd/mm/aaaa.** O ISO fica no JSON, que é o arquivo feito para máquina.
 * Aqui o destino é uma célula.
 */

/** Uma coluna da planilha: o rótulo que a pessoa lê e de onde o valor sai. */
export type ColunaCsv = {
  rotulo: string;
  valor: (registro: Record<string, unknown>) => string | number | null | undefined;
};

/**
 * O U+FEFF que faz o Excel entender que o arquivo é UTF-8.
 *
 * Sem ele "Endereço" abre como "EndereÃ§o": o Excel assume a codificação do
 * sistema quando o arquivo não se identifica. Fica fora de `gerarCsv` porque é
 * assunto do arquivo, não do conteúdo — quem só quer o texto não leva o marcador
 * junto.
 */
// ⚠️ O caractere aqui é invisível, e é para ser: é o marcador em si. Só não
// escreva U+FEFF fora de uma string neste arquivo — `no-irregular-whitespace`
// ignora strings e reprova o resto, e com razão: num comentário ninguém
// distingue "tem um BOM" de "não tem nada".
export const BOM_DO_EXCEL = "﻿";

/** `;`, e não `,` — ver a nota de formato no topo. */
const SEPARADOR = ";";

/**
 * Neutraliza fórmula em célula.
 *
 * Um valor que começa com `=`, `+`, `-` ou `@` é executado como fórmula quando a
 * planilha abre. O nome de uma empresa não deveria poder virar `=HYPERLINK(...)`
 * na máquina de quem receber o arquivo. O apóstrofo é a marca que a planilha usa
 * para "isto é texto" e não aparece na célula.
 *
 * Só texto passa por aqui: número é convertido depois, e `-3` continua sendo −3.
 */
function neutralizarFormula(texto: string): string {
  return /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto;
}

/** Aspas, quebra de linha e o próprio separador exigem o campo entre aspas. */
function escapar(texto: string): string {
  if (!/[";\n\r]/.test(texto)) return texto;
  return `"${texto.replace(/"/g, '""')}"`;
}

/** Número no formato que a planilha em português lê como número. */
export function numeroParaCelula(valor: number): string {
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Data ISO em `dd/mm/aaaa hh:mm`. Vazio quando não há data — não "Invalid Date". */
export function dataParaCelula(valor: unknown): string {
  if (typeof valor !== "string" || !valor.trim()) return "";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(data);
}

/** `true` vira "Sim". A planilha não é lugar de `TRUE`. */
export function simOuNao(valor: unknown): string {
  return valor ? "Sim" : "Não";
}

function celula(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "number") {
    return Number.isFinite(valor) ? escapar(numeroParaCelula(valor)) : "";
  }
  return escapar(neutralizarFormula(valor));
}

/**
 * A planilha de uma seção.
 *
 * Devolve string vazia quando não há registro: quem chama decide se isso é um
 * arquivo com só o cabeçalho ou um botão desligado — e a tela escolhe desligar o
 * botão, porque baixar um arquivo vazio parece falha.
 */
export function gerarCsv(colunas: ColunaCsv[], registros: Record<string, unknown>[]): string {
  // CRLF: é o que o RFC 4180 define, e o que o Excel espera em arquivo salvo no
  // Windows. `\n` sozinho funciona na maioria dos leitores e não em todos.
  const linhas = [colunas.map((coluna) => escapar(coluna.rotulo)).join(SEPARADOR)];

  for (const registro of registros) {
    linhas.push(colunas.map((coluna) => celula(coluna.valor(registro))).join(SEPARADOR));
  }

  return `${linhas.join("\r\n")}\r\n`;
}
