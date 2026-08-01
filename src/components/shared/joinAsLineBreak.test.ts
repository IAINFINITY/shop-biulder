import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";
import { JoinAsLineBreak } from "./joinAsLineBreak";

let editor: Editor | null = null;

function makeEditor(content: string) {
  editor = new Editor({
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] } }), JoinAsLineBreak],
    content,
  });
  return editor;
}

/** Posiciona o cursor no primeiro caractere do paragrafo de indice `index`. */
function cursorAtStartOfParagraph(ed: Editor, index: number) {
  let seen = -1;
  let target: number | null = null;
  ed.state.doc.descendants((node, pos) => {
    if (node.type.name !== "paragraph") return true;
    seen += 1;
    if (seen === index && target === null) target = pos + 1;
    return false;
  });
  if (target === null) throw new Error(`paragrafo ${index} nao encontrado`);
  ed.commands.setTextSelection(target);
}

function pressBackspace(ed: Editor) {
  // A extensao registra o atalho; chamar o handler direto evita depender de
  // eventos de teclado sinteticos no jsdom.
  const handler = ed.extensionManager.extensions.find((e) => e.name === "joinAsLineBreak");
  const shortcuts = handler?.config.addKeyboardShortcuts?.call({ editor: ed, options: {} });
  return shortcuts?.Backspace?.() ?? false;
}

afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe("JoinAsLineBreak", () => {
  it("primeiro Backspace vira quebra de linha, nao emenda o texto", () => {
    const ed = makeEditor("<p>Sugestão de consumo: ingerir 1 cápsula ao dia.</p><p>Ou conforme orientação.</p>");
    cursorAtStartOfParagraph(ed, 1);

    expect(pressBackspace(ed)).toBe(true);

    const html = ed.getHTML();
    expect(html).toContain("<br>");
    // Um paragrafo so, com as duas linhas dentro.
    expect(html.match(/<p>/g)).toHaveLength(1);
    // E o defeito que motivou tudo: as frases nao podem ficar coladas.
    expect(html).not.toContain("dia.Ou conforme");
  });

  it("segundo Backspace emenda de fato", () => {
    const ed = makeEditor("<p>Primeira linha</p><p>Segunda linha</p>");
    cursorAtStartOfParagraph(ed, 1);
    pressBackspace(ed);

    // Agora o cursor esta logo apos o <br>: o padrao do editor o remove.
    expect(pressBackspace(ed)).toBe(false);
    ed.commands.deleteRange({ from: ed.state.selection.from - 1, to: ed.state.selection.from });
    expect(ed.getHTML()).not.toContain("<br>");
  });

  it("nao interfere no meio do paragrafo", () => {
    const ed = makeEditor("<p>Primeira linha</p><p>Segunda linha</p>");
    cursorAtStartOfParagraph(ed, 1);
    ed.commands.setTextSelection(ed.state.selection.from + 3);
    expect(pressBackspace(ed)).toBe(false);
  });

  it("nao interfere quando o bloco anterior nao e paragrafo", () => {
    const ed = makeEditor("<h2>Titulo</h2><p>Texto</p>");
    cursorAtStartOfParagraph(ed, 0);
    expect(pressBackspace(ed)).toBe(false);
  });

  it("deixa o padrao remover a linha em branco", () => {
    const ed = makeEditor("<p></p><p>Texto</p>");
    cursorAtStartOfParagraph(ed, 1);
    expect(pressBackspace(ed)).toBe(false);
  });

  it("nao interfere dentro de lista", () => {
    const ed = makeEditor("<ul><li><p>Um</p></li><li><p>Dois</p></li></ul>");
    cursorAtStartOfParagraph(ed, 1);
    expect(pressBackspace(ed)).toBe(false);
  });
});
