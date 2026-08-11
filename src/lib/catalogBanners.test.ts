import { describe, expect, it } from "vitest";
import { nomeDoArquivoDeBanner } from "@/lib/catalogBanners";

const CARIMBO = 1786484550;

describe("nomeDoArquivoDeBanner", () => {
  it("usa o nome que a pessoa digitou", () => {
    expect(nomeDoArquivoDeBanner({ label: "Alga", slot: "topo", carimbo: CARIMBO })).toBe(
      "banner-topo-alga-1786484550",
    );
  });

  it("resolve acento, espaço e maiúscula", () => {
    // O nome vira caminho de URL. Sem normalizar, "Promoção de Verão" sairia
    // com escape (`Promo%C3%A7%C3%A3o`) e deixaria de ser legível — que é o
    // único motivo desta função existir.
    expect(nomeDoArquivoDeBanner({ label: "Promoção de Verão", slot: "par", carimbo: CARIMBO })).toBe(
      "banner-par-promocao-de-verao-1786484550",
    );
  });

  it("separa a arte de celular da de desktop", () => {
    const desktop = nomeDoArquivoDeBanner({ label: "Alga", slot: "topo", carimbo: CARIMBO });
    const celular = nomeDoArquivoDeBanner({
      label: "Alga",
      slot: "topo",
      variante: "celular",
      carimbo: CARIMBO,
    });
    expect(celular).not.toBe(desktop);
    expect(celular).toContain("celular");
  });

  it("dois banners com o mesmo nome não colidem", () => {
    // O upload usa `upsert: true`. Caminhos iguais fariam o segundo sobrescrever
    // a arte do primeiro sem erro nenhum — um banner trocaria de imagem sozinho.
    const primeiro = nomeDoArquivoDeBanner({ label: "Whey", slot: "topo", carimbo: CARIMBO });
    const segundo = nomeDoArquivoDeBanner({ label: "Whey", slot: "topo", carimbo: CARIMBO + 1 });
    expect(primeiro).not.toBe(segundo);
  });

  it("nome vazio não deixa traço duplo no arquivo", () => {
    // Dá para escolher a imagem antes de digitar o nome: o campo está acima,
    // mas nada obriga a ordem.
    expect(nomeDoArquivoDeBanner({ label: "   ", slot: "topo", carimbo: CARIMBO })).toBe(
      "banner-topo-1786484550",
    );
  });

  it("só produz caracteres que sobrevivem a uma URL", () => {
    const nome = nomeDoArquivoDeBanner({
      label: "50% OFF!! Verão/2026 — só hoje",
      slot: "destaque",
      carimbo: CARIMBO,
    });
    expect(nome).toMatch(/^[a-z0-9-]+$/);
    expect(encodeURIComponent(nome)).toBe(nome);
  });
});
