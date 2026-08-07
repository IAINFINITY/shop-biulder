import { describe, expect, it } from "vitest";
import {
  construirPromptDeResumo,
  MAX_CARACTERES_POR_ITEM,
  MAX_ITENS,
  MIN_ITENS,
  normalizarResumo,
  resumoParaTexto,
  textoParaResumo,
  validarResumo,
} from "@/lib/resumoDeProduto";

describe("construirPromptDeResumo", () => {
  it("leva nome, marca, categoria e descrição", () => {
    const { usuario } = construirPromptDeResumo({
      name: "Whey Isolado",
      description: "Suplemento proteico.",
      brand: "Clinic Mais",
      type: "Pó",
    });
    expect(usuario).toContain("Whey Isolado");
    expect(usuario).toContain("Clinic Mais");
    expect(usuario).toContain("Pó");
    expect(usuario).toContain("Suplemento proteico.");
  });

  it("omite a linha do campo ausente em vez de escrever 'null'", () => {
    const { usuario } = construirPromptDeResumo({
      name: "Chá",
      description: "Erva.",
      brand: null,
      type: null,
    });
    expect(usuario).not.toMatch(/null|undefined|Marca:|Categoria:/);
  });

  it("o sistema proíbe alegação terapêutica explicitamente", () => {
    const { sistema } = construirPromptDeResumo({ name: "X", description: "Y" });
    expect(sistema).toMatch(/cura, trata, previne/);
    expect(sistema).toContain("português do Brasil");
  });

  it("o sistema manda restrição vencer atributo positivo", () => {
    // Sem esta linha o modelo mantinha "não contém glúten" e descartava "contém
    // óleo de peixe" — a omissão é o risco que a validação não alcança, porque
    // ela só lê o que está escrito, nunca o que deixou de estar.
    const { sistema } = construirPromptDeResumo({ name: "X", description: "Y" });
    expect(sistema).toMatch(/alérgeno/i);
    expect(sistema).toMatch(/Restrição vence atributo positivo/i);
  });
});

describe("normalizarResumo", () => {
  it("aceita a lista limpa", () => {
    expect(normalizarResumo("Contém magnésio.\nAuxilia no metabolismo.")).toEqual([
      "Contém magnésio.",
      "Auxilia no metabolismo.",
    ]);
  });

  it("tira marcador, numeração e aspas — o modelo varia entre eles", () => {
    expect(
      normalizarResumo('- Contém magnésio.\n2) Auxilia no metabolismo.\n• Sem glúten.\n"Sem lactose."'),
    ).toEqual(["Contém magnésio.", "Auxilia no metabolismo.", "Sem glúten.", "Sem lactose."]);
  });

  it("descarta a linha de abertura e as linhas vazias", () => {
    expect(normalizarResumo("Resumo:\n\nContém zinco.\n\n  \nSem açúcar.")).toEqual([
      "Contém zinco.",
      "Sem açúcar.",
    ]);
  });

  it("corta no teto de itens", () => {
    const bruto = Array.from({ length: 9 }, (_, i) => `Item ${i}.`).join("\n");
    expect(normalizarResumo(bruto)).toHaveLength(MAX_ITENS);
  });
});

describe("validarResumo", () => {
  // Tres itens: e o piso da regra, entao serve de base para os casos que somam
  // uma frase proibida por cima sem estourar o teto de quatro.
  const bom = [
    "Contém magnésio e ácido málico.",
    "Auxilia no funcionamento muscular.",
    "Sugestão de consumo: 2 cápsulas ao dia.",
  ];

  it("aprova o resumo dentro da regra", () => {
    expect(validarResumo(bom)).toEqual({ ok: true, motivo: null });
  });

  it("recusa alegação de cura, tratamento ou prevenção", () => {
    for (const frase of [
      "Trata dores musculares.",
      "Ajuda a prevenir a osteoporose.",
      "Tem efeito terapêutico comprovado.",
      "Substitui o medicamento do dia a dia.",
    ]) {
      const r = validarResumo([...bom, frase]);
      expect(r.ok, frase).toBe(false);
    }
  });

  it("recusa promessa de emagrecimento e de resultado", () => {
    for (const frase of [
      "Emagrece em duas semanas.",
      "Resultado garantido em 30 dias.",
      "Sem efeitos colaterais.",
      "Efeito imediato na primeira dose.",
    ]) {
      expect(validarResumo([...bom, frase]).ok, frase).toBe(false);
    }
  });

  it("acento não escapa da checagem", () => {
    // "prevenção" precisa cair na mesma entrada que "prevencao".
    expect(validarResumo([...bom, "Indicado para prevenção de quedas."]).ok).toBe(false);
  });

  it("não confunde palavra que apenas contém o termo", () => {
    // "curativo" contém "cura", "contratado" contém "trata" — nenhum é alegação.
    expect(
      validarResumo([
        "Acompanha curativo estéril.",
        "Fornecedor contratado no Brasil.",
        "Embalagem com 60 unidades.",
      ]),
    ).toEqual({ ok: true, motivo: null });
  });

  it("recusa item longo demais para o card", () => {
    const longo = "a".repeat(MAX_CARACTERES_POR_ITEM + 1);
    expect(validarResumo([...bom, longo]).ok).toBe(false);
  });

  it("recusa resumo curto demais ou longo demais", () => {
    expect(validarResumo(Array.from({ length: MIN_ITENS - 1 }, (_, i) => `Item ${i}.`)).ok).toBe(false);
    expect(validarResumo(Array.from({ length: MAX_ITENS + 1 }, (_, i) => `Item ${i}.`)).ok).toBe(false);
  });

  it("aceita o piso e o teto — a faixa é estreita de propósito", () => {
    const item = (i: number) => `Item ${i}.`;
    expect(validarResumo(Array.from({ length: MIN_ITENS }, (_, i) => item(i))).ok).toBe(true);
    expect(validarResumo(Array.from({ length: MAX_ITENS }, (_, i) => item(i))).ok).toBe(true);
  });

  it("o motivo diz o que fazer, e não só que deu errado", () => {
    const r = validarResumo([...bom, "Cura a gripe."]);
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/alegação proibida|Gere de novo/);
  });
});

describe("ida e volta do banco", () => {
  it("guarda um item por linha e devolve a mesma lista", () => {
    const itens = ["Contém magnésio.", "Sem glúten."];
    expect(textoParaResumo(resumoParaTexto(itens))).toEqual(itens);
  });

  it("nulo e vazio viram lista vazia — o card cai na descrição", () => {
    expect(textoParaResumo(null)).toEqual([]);
    expect(textoParaResumo("")).toEqual([]);
    expect(textoParaResumo("   \n  \n ")).toEqual([]);
  });
});
