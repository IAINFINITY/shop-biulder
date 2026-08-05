import { describe, expect, it } from "vitest";
import { parseSupabaseTextArray, resolveProductImageUrls } from "@/lib/products";

const BUCKET = "product-images";
const NOVO = "https://novo-projeto.supabase.co";
const ANTIGO = "https://antigo-projeto.supabase.co";

const url = (host: string, name: string) => `${host}/storage/v1/object/public/${BUCKET}/${name}`;

describe("resolveProductImageUrls", () => {
  it("não repete a foto quando a capa e a galeria estão em hosts diferentes", () => {
    // Cenario real depois da migracao de projeto do Supabase: `image_url` sai
    // normalizado para o host novo e `image_urls` continua com o host antigo.
    const gallery = resolveProductImageUrls(url(NOVO, "7912.webp"), [url(ANTIGO, "7912.webp")]);

    expect(gallery).toHaveLength(1);
  });

  it("não repete quando a mesma foto vem com query de cache", () => {
    const gallery = resolveProductImageUrls(url(NOVO, "7912.webp"), [`${url(NOVO, "7912.webp")}?v=2`]);

    expect(gallery).toHaveLength(1);
  });

  it("preserva a ordem e mantém fotos distintas", () => {
    const gallery = resolveProductImageUrls(url(NOVO, "7912.webp"), [
      url(ANTIGO, "7912.webp"),
      url(ANTIGO, "7912_2.webp"),
      url(ANTIGO, "7912_3.webp"),
    ]);

    expect(gallery).toHaveLength(3);
    expect(gallery.map((item) => item.split("/").pop())).toEqual([
      "7912.webp",
      "7912_2.webp",
      "7912_3.webp",
    ]);
  });

  it("mantém a capa na primeira posição", () => {
    const gallery = resolveProductImageUrls(url(NOVO, "7912_2.webp"), [url(NOVO, "7912.webp")]);

    expect(gallery[0]).toContain("7912_2.webp");
  });

  it("aceita galeria vazia e capa ausente", () => {
    expect(resolveProductImageUrls(null, null)).toEqual([]);
    expect(resolveProductImageUrls("", [])).toEqual([]);
  });

  it("preserva URLs fora do bucket", () => {
    const externa = "https://cdn-externo.com/foto.jpg";
    const gallery = resolveProductImageUrls(null, [externa]);

    expect(gallery).toEqual([externa]);
  });
});

describe("parseSupabaseTextArray", () => {
  it("separa o literal do Postgres em várias URLs", () => {
    const literal = `{${url(NOVO, "7912.webp")},${url(NOVO, "7912_2.webp")}}`;

    expect(parseSupabaseTextArray(literal)).toEqual([
      url(NOVO, "7912.webp"),
      url(NOVO, "7912_2.webp"),
    ]);
  });

  it("não separa vírgula dentro de aspas", () => {
    const literal = `{"${url(NOVO, "foto,1.webp")}","${url(NOVO, "7912.webp")}"}`;

    expect(parseSupabaseTextArray(literal)).toEqual([
      url(NOVO, "foto,1.webp"),
      url(NOVO, "7912.webp"),
    ]);
  });

  it("não injeta grupos capturados no resultado", () => {
    // Regressao: a regex tinha perdido os `?` do lookahead e dos grupos
    // nao-capturantes, e `split` com grupo de captura devolve o que capturou.
    const literal = `{${url(NOVO, "7912.webp")},${url(NOVO, "7912_2.webp")}}`;

    for (const item of parseSupabaseTextArray(literal)) {
      expect(typeof item).toBe("string");
      expect(item.startsWith("http")).toBe(true);
    }
  });

  it("aceita array já pronto e valores vazios", () => {
    expect(parseSupabaseTextArray([url(NOVO, "7912.webp"), "  "])).toEqual([url(NOVO, "7912.webp")]);
    expect(parseSupabaseTextArray(null)).toEqual([]);
    expect(parseSupabaseTextArray("{}")).toEqual([]);
  });
});
