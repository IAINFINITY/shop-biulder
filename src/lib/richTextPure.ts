import DOMPurify from "dompurify";

const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "strike",
  "h2",
  "h3",
  "ul",
  "ol",
  "li",
  "span",
  "h4",
  "a",
  "blockquote",
  "hr",
];

const ALLOWED_ATTR = ["style", "href", "target", "rel"];
const LEGACY_DESCRIPTION_LABELS = new Set(["descricao", "conteudo", "cod", "codigo"]);
const LEGACY_BULLET_LINE_RE = /^(?::?[-*•]+|\d+[.)])\s+/;

function normalizeLegacyKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

export function stripHtml(html: string): string {
  if (!html) return "";
  if (!html.includes("<")) return html;
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: [] }).trim();
}

export function normalizeLegacyDescriptionText(text: string): string {
  if (!text) return "";
  return text.replace(/\r\n/g, "\n").replace(/\u00a0/g, " ").trim();
}

export type LegacyDescriptionBlock =
  | {
      type: "paragraph";
      text: string;
    }
  | {
      type: "list";
      items: string[];
    };

export function splitLegacyDescriptionBlocks(text: string): LegacyDescriptionBlock[] {
  const normalized = normalizeLegacyDescriptionText(text);
  if (!normalized) return [];

  const rawLines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const lines =
    rawLines.length > 1 && LEGACY_DESCRIPTION_LABELS.has(normalizeLegacyKey(rawLines[0]))
      ? rawLines.slice(1)
      : rawLines;

  if (lines.length === 0) return [];

  const blocks: LegacyDescriptionBlock[] = [];
  let paragraphParts: string[] = [];
  let listItems: string[] = [];

  const flushParagraph = () => {
    if (paragraphParts.length === 0) return;
    const text = paragraphParts.join(" ").replace(/\s+/g, " ").trim();
    if (text) blocks.push({ type: "paragraph", text });
    paragraphParts = [];
  };

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push({ type: "list", items: listItems });
    listItems = [];
  };

  for (const line of lines) {
    const bulletMatch = line.match(LEGACY_BULLET_LINE_RE);
    if (bulletMatch) {
      flushParagraph();
      listItems.push(line.replace(LEGACY_BULLET_LINE_RE, "").trim());
      continue;
    }

    flushList();
    paragraphParts.push(line);
  }

  flushParagraph();
  flushList();

  if (blocks.length === 1 && blocks[0].type === "paragraph") {
    const sentences = (blocks[0].text.match(/[^.!]+[.!]*(:\s+|$)/g) ?? [])
      .map((part) => part.trim())
      .filter(Boolean);
    if (sentences.length > 1 && blocks[0].text.length >= 140) {
      return sentences.map((text) => ({ type: "paragraph", text }));
    }
  }

  return blocks;
}

/**
 * Paragrafos vazios no fim do texto, que o editor deixa quando se aperta Enter
 * antes de sair do campo. No meio do texto a linha em branco e intencional e
 * fica; no fim e so sobra, e agora que paragrafo vazio ocupa uma linha ela
 * apareceria como espaco solto embaixo da descricao.
 */
const TRAILING_EMPTY_PARAGRAPHS = /(?:<p>(?:\s|<br\s*\/?>)*<\/p>)+$/i;

export function sanitizeRichText(html: string): string {
  if (!html) return "";
  if (!html.includes("<")) return html;
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  });
  return clean.replace(TRAILING_EMPTY_PARAGRAPHS, "");
}

/**
 * A descricao ja veio formatada, ou e texto corrido de sistema antigo?
 *
 * Duas origens convivem no catalogo:
 *
 * - texto cru vindo do ERP, sem marcacao nenhuma ou embrulhado num unico <p>:
 *   ai vale inferir paragrafos e listas a partir das quebras de linha, que e o
 *   que `extractDescriptionBlocks` faz;
 * - HTML escrito no editor do admin, com titulo, negrito e lista numerada. Esse
 *   nao pode passar pela inferencia: ela le so o `textContent`, entao apaga
 *   titulo, negrito e numeracao, e ainda quebra paragrafo longo em uma frase
 *   por bloco. O texto sai inteiro, mas sem hierarquia — parece "todo separado".
 *
 * Dois sinais denunciam o editor. O primeiro e marcacao que so ele produz —
 * `<br>` incluido, porque quebra de linha dentro do paragrafo e decisao de quem
 * escreveu e a inferencia descartaria.
 *
 * O segundo e a quantidade de blocos: o dump do ERP vem como um paragrafo unico,
 * enquanto quem escreve no editor separa em varios. Sem esse segundo sinal, uma
 * descricao so de paragrafos — sem titulo e sem negrito — caia na inferencia e
 * perdia as linhas em branco que a pessoa tinha acabado de colocar.
 */
export function hasAuthoredStructure(html: string): boolean {
  if (!html || !html.includes("<")) return false;

  const sanitized = sanitizeRichText(html);
  if (/<(h[1-4]|ul|ol|li|strong|b|em|i|u|s|blockquote|hr|a|br)\b/i.test(sanitized)) return true;

  return (sanitized.match(/<p\b/gi)?.length ?? 0) > 1;
}

/**
 * Primeiro paragrafo de verdade, para a previa do card.
 *
 * Pula titulo: numa descricao formatada o primeiro bloco costuma ser um <h2>
 * como "O QUE E A VITAMINA D3?", que na previa nao informa nada.
 */
export function extractDescriptionPreview(html: string): string {
  if (!html) return "";
  if (!html.includes("<")) return stripHtml(html);

  const sanitized = sanitizeRichText(html);
  if (typeof document === "undefined") return stripHtml(sanitized);

  const root = document.createElement("div");
  root.innerHTML = sanitized;

  for (const node of Array.from(root.children)) {
    if (/^h[1-4]$/i.test(node.tagName)) continue;
    const text = normalizeLegacyDescriptionText(node.textContent ?? "");
    if (text) return text;
  }

  return stripHtml(sanitized);
}

export function extractDescriptionBlocks(content: string): LegacyDescriptionBlock[] {
  const normalized = normalizeLegacyDescriptionText(content);
  if (!normalized) return [];

  if (!normalized.includes("<")) {
    return splitLegacyDescriptionBlocks(normalized);
  }

  const sanitized = sanitizeRichText(normalized);
  if (!sanitized) return [];

  if (typeof document === "undefined") {
    return splitLegacyDescriptionBlocks(stripHtml(sanitized));
  }

  const root = document.createElement("div");
  root.innerHTML = sanitized;

  const blocks: LegacyDescriptionBlock[] = [];
  for (const node of Array.from(root.children)) {
    const tag = node.tagName.toLowerCase();

    if (tag === "ul" || tag === "ol") {
      const items = Array.from(node.querySelectorAll("li"))
        .map((li) => li.textContent.trim() ?? "")
        .filter(Boolean);
      if (items.length > 0) blocks.push({ type: "list", items });
      continue;
    }

    if (tag === "p" || tag === "h2" || tag === "h3" || tag === "blockquote") {
      const innerText = normalizeLegacyDescriptionText(node.textContent ?? "");
      if (!innerText) continue;
      blocks.push(...splitLegacyDescriptionBlocks(innerText));
    }
  }

  if (blocks.length === 0) {
    const fallback = stripHtml(sanitized);
    return splitLegacyDescriptionBlocks(fallback);
  }

  if (blocks.length === 1 && blocks[0].type === "paragraph") {
    const sentences = (blocks[0].text.match(/[^.!]+[.!]*(:\s+|$)/g) ?? [])
      .map((part) => part.trim())
      .filter(Boolean);
    if (sentences.length > 1 && blocks[0].text.length >= 140) {
      return sentences.map((text) => ({ type: "paragraph", text }));
    }
  }

  return blocks;
}

/** Quantas frases cabem no card de resumo sem virar uma segunda descricao. */
const SUMMARY_SENTENCES = 3;

/**
 * Primeiras frases da descricao, para o card "Resumo" ao lado do preco.
 *
 * Nao ha campo separado a preencher: sai da propria descricao, entao um produto
 * bem descrito ganha o resumo de graca. Mora aqui, e nao junto do componente,
 * porque arquivo que exporta componente e funcao junto quebra o Fast Refresh e
 * duplica o modulo.
 */
export function summarizeDescription(html: string): string[] {
  const plain = stripHtml(html).replace(/\s+/g, " ").trim();
  if (!plain) return [];
  return plain
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, SUMMARY_SENTENCES);
}

export function isRichTextEmpty(html: string): boolean {
  return stripHtml(html).length === 0;
}

export function descriptionIncludesQuery(description: string, query: string): boolean {
  return stripHtml(description).toLowerCase().includes(query.toLowerCase());
}
