import { Extension } from "@tiptap/core";
import { TextStyle } from "@tiptap/extension-text-style";

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

/**
 * Declara os comandos da extensao para o TipTap.
 *
 * Sem este bloco o `editor.chain()` nao conhece `setTextAlign` nem
 * `unsetTextAlign` — a extensao funcionava em runtime, mas cada uso na barra de
 * ferramentas acusava "propriedade nao existe". E o mecanismo padrao do TipTap
 * para comandos proprios.
 */
declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    textAlign: {
      setTextAlign: (alignment: "left" | "center" | "right" | "justify") => ReturnType;
      unsetTextAlign: () => ReturnType;
    };
  }
}

export const TextAlign = Extension.create({
  name: "textAlign",
  addOptions() {
    return { types: ["heading", "paragraph", "listItem"] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          textAlign: {
            default: null,
            parseHTML: (element) => element.style.textAlign || null,
            renderHTML: (attributes) => {
              if (!attributes.textAlign) return {};
              return { style: `text-align: ${attributes.textAlign}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setTextAlign:
        (alignment: "left" | "center" | "right" | "justify") =>
        ({ commands }) => {
          let updated = false;
          for (const type of this.options.types) {
            updated = commands.updateAttributes(type, { textAlign: alignment }) || updated;
          }
          return updated;
        },
      unsetTextAlign:
        () =>
        ({ commands }) => {
          let updated = false;
          for (const type of this.options.types) {
            updated = commands.updateAttributes(type, { textAlign: null }) || updated;
          }
          return updated;
        },
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
