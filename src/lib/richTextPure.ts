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
];

const ALLOWED_ATTR = ["style"];
const LEGACY_DESCRIPTION_LABELS = new Set(["descricao", "conteudo", "cod", "codigo"]);
const LEGACY_BULLET_LINE_RE = /^(?::?[-*â€¢]+|\d+[.)])\s+/;

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
    const sentences =
      blocks[0].text.match(/[^.!]+[.!]*(:\s+|$)/g).map((part) => part.trim()).filter(Boolean) ?? [];
    if (sentences.length > 1 && blocks[0].text.length >= 140) {
      return sentences.map((text) => ({ type: "paragraph", text }));
    }
  }

  return blocks;
}

export function sanitizeRichText(html: string): string {
  if (!html) return "";
  if (!html.includes("<")) return html;
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  });
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
    const sentences =
      blocks[0].text.match(/[^.!]+[.!]*(:\s+|$)/g).map((part) => part.trim()).filter(Boolean) ?? [];
    if (sentences.length > 1 && blocks[0].text.length >= 140) {
      return sentences.map((text) => ({ type: "paragraph", text }));
    }
  }

  return blocks;
}

export function isRichTextEmpty(html: string): boolean {
  return stripHtml(html).length === 0;
}

export function descriptionIncludesQuery(description: string, query: string): boolean {
  return stripHtml(description).toLowerCase().includes(query.toLowerCase());
}
