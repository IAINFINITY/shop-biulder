import DOMPurify from "dompurify";
import { Extension } from "@tiptap/core";
import { TextStyle } from "@tiptap/extension-text-style";

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

/** Remove tags para busca e pré-visualizações curtas. */
export function stripHtml(html: string): string {
  if (!html) return "";
  if (!html.includes("<")) return html;
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: [] }).trim();
}

/** HTML seguro para exibir na loja. */
export function sanitizeRichText(html: string): string {
  if (!html) return "";
  if (!html.includes("<")) return html;
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  });
}

export function isRichTextEmpty(html: string): boolean {
  return stripHtml(html).length === 0;
}

export function descriptionIncludesQuery(description: string, query: string): boolean {
  return stripHtml(description).toLowerCase().includes(query.toLowerCase());
}

/** Marca de tamanho de fonte para o editor Tiptap. */
export const FontSize = Extension.create({
  name: "fontSize",
  addOptions() {
    return { types: ["textStyle"] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontSize }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run(),
    };
  },
});

export { TextStyle };

export const FONT_SIZE_OPTIONS = [
  { label: "Pequeno", value: "14px" },
  { label: "Normal", value: "16px" },
  { label: "Médio", value: "18px" },
  { label: "Grande", value: "20px" },
  { label: "Muito grande", value: "24px" },
] as const;
