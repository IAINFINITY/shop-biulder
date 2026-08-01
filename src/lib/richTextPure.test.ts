import { describe, expect, it } from "vitest";
import {
  extractDescriptionBlocks,
  extractDescriptionPreview,
  hasAuthoredStructure,
  sanitizeRichText,
  summarizeDescription,
  splitLegacyDescriptionBlocks,
} from "./richTextPure";

// Recorte fiel da descricao da Vitamina D3 gravada no catalogo: titulo em h2 com
// negrito dentro, paragrafo com trechos em strong e lista numerada de
// referencias. Foi essa descricao que apareceu "toda separada" na pagina.
const AUTHORED = [
  "<h2><strong>O QUE É A VITAMINA D3 2000 UI?</strong></h2>",
  "<p>A <strong>Vitamina D3 2000 UI ClinicMais</strong> é um suplemento alimentar em cápsulas ",
  "gelatinosas que fornece <strong>50 mcg (2.000 UI) de colecalciferol por cápsula</strong>, ",
  "contribuindo para complementar a ingestão diária desse nutriente quando necessário.</p>",
  "<h2><strong>REFERÊNCIAS BIBLIOGRÁFICAS</strong></h2>",
  "<ol><li>Holick MF. Vitamin D Deficiency. New England Journal of Medicine. 2007.</li>",
  "<li>Bouillon R. Vitamin D and Human Health. Nature Reviews Endocrinology. 2022.</li></ol>",
].join("");

describe("hasAuthoredStructure", () => {
  it("reconhece descricao formatada no editor", () => {
    expect(hasAuthoredStructure(AUTHORED)).toBe(true);
  });

  it("nao confunde texto corrido com formatacao", () => {
    expect(hasAuthoredStructure("Suplemento alimentar em capsulas.")).toBe(false);
  });

  it("nao trata como formatado o texto legado embrulhado num unico paragrafo", () => {
    // Dump do ERP: veio dentro de <p>, mas quem escreveu nao formatou nada.
    // Esse ainda depende da inferencia de blocos para virar algo legivel.
    expect(hasAuthoredStructure("<p>Suplemento alimentar em capsulas.</p>")).toBe(false);
  });

  it("reconhece varios paragrafos como formatacao, mesmo sem titulo ou negrito", () => {
    // Texto so de paragrafos e o caso em que a linha em branco importa: se cair
    // na inferencia de blocos, ela e descartada e o save "nao reflete".
    expect(hasAuthoredStructure("<p>Primeiro</p><p></p><p>Segundo</p>")).toBe(true);
  });

  it("reconhece quebra de linha como formatacao", () => {
    // Texto so com <br> nao tem titulo nem negrito, mas foi formatado: se cair
    // na inferencia de blocos, a quebra some e o paragrafo e picado por frase.
    expect(hasAuthoredStructure("<p>Oi<br>Ola</p>")).toBe(true);
  });

  it("ignora tag que o sanitizador remove", () => {
    expect(hasAuthoredStructure("<script>alert(1)</script>Texto")).toBe(false);
  });
});

describe("sanitizeRichText", () => {
  it("preserva titulo, negrito e lista numerada", () => {
    const output = sanitizeRichText(AUTHORED);
    expect(output).toContain("<h2>");
    expect(output).toContain("<strong>");
    expect(output).toContain("<ol>");
    expect(output).toContain("<li>");
  });

  it("mantem link, citacao e regua, que as classes de tipografia estilizam", () => {
    const output = sanitizeRichText(
      '<p><a href="https://exemplo.com">fonte</a></p><blockquote>nota</blockquote><hr>',
    );
    expect(output).toContain("<a");
    expect(output).toContain('href="https://exemplo.com"');
    expect(output).toContain("<blockquote>");
    expect(output).toContain("<hr>");
  });

  it("preserva a quebra de linha dentro do paragrafo", () => {
    expect(sanitizeRichText("<p>Oi<br>Ola</p>")).toContain("<br>");
  });

  it("remove script e atributo de evento", () => {
    const output = sanitizeRichText('<p onclick="steal()">oi</p><script>alert(1)</script>');
    expect(output).not.toContain("script");
    expect(output).not.toContain("onclick");
    expect(output).toContain("oi");
  });
});

describe("sanitizeRichText — sobras do editor", () => {
  it("mantem a linha em branco no meio do texto", () => {
    expect(sanitizeRichText("<p>Um</p><p></p><p>Dois</p>")).toBe("<p>Um</p><p></p><p>Dois</p>");
  });

  it("descarta os paragrafos vazios do fim", () => {
    expect(sanitizeRichText("<p>Um</p><p></p><p></p>")).toBe("<p>Um</p>");
  });

  it("descarta tambem os que trazem <br> dentro", () => {
    expect(sanitizeRichText("<p>Um</p><p><br></p>")).toBe("<p>Um</p>");
  });
});

describe("extractDescriptionPreview", () => {
  it("pula o titulo e devolve o primeiro paragrafo", () => {
    const preview = extractDescriptionPreview(AUTHORED);
    expect(preview.startsWith("A Vitamina D3 2000 UI ClinicMais")).toBe(true);
    expect(preview).not.toContain("O QUE É");
  });

  it("devolve o proprio texto quando nao ha marcacao", () => {
    expect(extractDescriptionPreview("Cha de hibisco em saches.")).toBe("Cha de hibisco em saches.");
  });
});

describe("splitLegacyDescriptionBlocks", () => {
  it("reconhece lista iniciada por bullet", () => {
    // O caractere • estava corrompido no regex e a lista nunca era detectada.
    const blocks = splitLegacyDescriptionBlocks("Beneficios:\n• Energia\n• Imunidade");
    expect(blocks).toContainEqual({ type: "list", items: ["Energia", "Imunidade"] });
  });

  it("nao estoura quando o paragrafo longo nao tem pontuacao final", () => {
    const semPonto = "palavra ".repeat(30).trim();
    expect(() => splitLegacyDescriptionBlocks(semPonto)).not.toThrow();
  });
});

describe("summarizeDescription", () => {
  it("devolve ate tres frases, sem marcacao", () => {
    const resumo = summarizeDescription(AUTHORED);
    expect(resumo).toHaveLength(3);
    expect(resumo.join(" ")).not.toContain("<");
    expect(resumo[0]).toContain("O QUE É A VITAMINA D3");
  });

  it("devolve vazio quando nao ha descricao", () => {
    expect(summarizeDescription("")).toEqual([]);
    expect(summarizeDescription("<p></p>")).toEqual([]);
  });

  it("trata texto sem pontuacao como uma frase so", () => {
    expect(summarizeDescription("Suplemento em capsulas")).toEqual(["Suplemento em capsulas"]);
  });
});

describe("extractDescriptionBlocks", () => {
  it("infere paragrafo e lista a partir de texto cru", () => {
    const blocks = extractDescriptionBlocks("Suplemento em capsulas.\n- Vitamina D\n- Oleo de girassol");
    expect(blocks[0]).toEqual({ type: "paragraph", text: "Suplemento em capsulas." });
    expect(blocks[1]).toEqual({ type: "list", items: ["Vitamina D", "Oleo de girassol"] });
  });
});
