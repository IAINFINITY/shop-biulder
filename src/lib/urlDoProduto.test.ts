import { describe, it, expect } from "vitest";
import {
  slugificar,
  identificadorDoProduto,
  caminhoDoProduto,
  codigoNaUrl,
  encontrarProdutoPelaUrl,
} from "@/lib/urlDoProduto";

const cha = { id: "8eb8f847-4041-446d-a128-083633073c41", product_code: "2188", name: "Chá Mais Anis Estrelado" };
const wheyIsolado = { id: "11111111-1111-1111-1111-111111111111", product_code: "WHEY.01", name: "Whey Isolado 900g" };
const semCodigo = { id: "22222222-2222-2222-2222-222222222222", product_code: null, name: "Produto sem código" };
const catalogo = [cha, wheyIsolado, semCodigo];

describe("slugificar", () => {
  it("tira acento sem comer a letra", () => {
    expect(slugificar("Chá Mais Anis Estrelado")).toBe("cha-mais-anis-estrelado");
    expect(slugificar("Ação Nutrição")).toBe("acao-nutricao");
  });

  it("junta simbolo e espaco num hifen so, sem sobrar hifen na ponta", () => {
    expect(slugificar("  Whey 100% — Isolado (900g)!  ")).toBe("whey-100-isolado-900g");
  });

  it("corta longo sem deixar hifen solto no fim", () => {
    const slug = slugificar("a".repeat(58) + " palavra extra");
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("texto sem letra nem numero vira vazio", () => {
    expect(slugificar("★ ★ ★")).toBe("");
  });
});

describe("identificadorDoProduto", () => {
  it("e nome legivel mais o codigo", () => {
    expect(identificadorDoProduto(cha)).toBe("cha-mais-anis-estrelado-2188");
    expect(caminhoDoProduto(cha)).toBe("/produto/cha-mais-anis-estrelado-2188");
  });

  it("sem codigo utilizavel, cai no id — link feio, mas link", () => {
    expect(identificadorDoProduto(semCodigo)).toBe(semCodigo.id);
    expect(identificadorDoProduto({ id: "abc", product_code: "12 34/56", name: "Nome" })).toBe("abc");
  });

  it("sem nome, fica so o codigo", () => {
    expect(identificadorDoProduto({ id: "abc", product_code: "2188", name: null })).toBe("2188");
  });

  it("nao produz nada que precise de escape na URL", () => {
    for (const produto of catalogo) {
      const ident = identificadorDoProduto(produto);
      expect(encodeURIComponent(ident)).toBe(ident);
    }
  });
});

describe("codigoNaUrl", () => {
  it("pega o trecho depois do ultimo hifen", () => {
    expect(codigoNaUrl("cha-mais-anis-estrelado-2188")).toBe("2188");
    expect(codigoNaUrl("whey-isolado-900g-WHEY.01")).toBe("WHEY.01");
  });

  it("nao inventa codigo onde nao ha hifen", () => {
    expect(codigoNaUrl("2188")).toBeNull();
  });
});

describe("encontrarProdutoPelaUrl", () => {
  it("acha pelo endereco atual", () => {
    expect(encontrarProdutoPelaUrl(catalogo, "cha-mais-anis-estrelado-2188")).toBe(cha);
  });

  it("aceita o codigo puro, que foi o formato de um deploy", () => {
    expect(encontrarProdutoPelaUrl(catalogo, "2188")).toBe(cha);
    expect(encontrarProdutoPelaUrl(catalogo, "WHEY.01")).toBe(wheyIsolado);
  });

  it("aceita o UUID, que e o formato dos links ja compartilhados", () => {
    expect(encontrarProdutoPelaUrl(catalogo, cha.id)).toBe(cha);
    expect(encontrarProdutoPelaUrl(catalogo, semCodigo.id)).toBe(semCodigo);
  });

  it("produto renomeado nao quebra o link antigo — quem resolve e o codigo", () => {
    expect(encontrarProdutoPelaUrl(catalogo, "nome-completamente-outro-2188")).toBe(cha);
  });

  it("devolve nulo para o que nao existe, e nao explode com URL torta", () => {
    expect(encontrarProdutoPelaUrl(catalogo, "nao-existe-9999")).toBeNull();
    expect(encontrarProdutoPelaUrl(catalogo, "")).toBeNull();
    expect(encontrarProdutoPelaUrl(catalogo, undefined)).toBeNull();
    expect(encontrarProdutoPelaUrl(catalogo, "%")).toBeNull();
    expect(encontrarProdutoPelaUrl(catalogo, "%E0%A4%A")).toBeNull();
  });

  it("ida e volta: todo produto do catalogo se acha pelo proprio endereco", () => {
    for (const produto of catalogo) {
      expect(encontrarProdutoPelaUrl(catalogo, identificadorDoProduto(produto))).toBe(produto);
    }
  });
});
