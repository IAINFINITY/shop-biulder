import { describe, expect, it } from "vitest";
import {
  classifyMediaFiles,
  reframedNameOf,
  storageObjectName,
  summarizeMediaFiles,
  type MediaFileInput,
  type UsageSource,
} from "./mediaLibrary";

const BUCKET = "product-images";
const base = `https://projeto.supabase.co/storage/v1/object/public/${BUCKET}/`;

const file = (name: string, sizeBytes = 1024): MediaFileInput => ({
  name,
  publicUrl: `${base}${name}`,
  sizeBytes,
  createdAt: null,
});

describe("storageObjectName", () => {
  it("extrai o nome do arquivo da URL publica", () => {
    expect(storageObjectName(`${base}foto.webp`, BUCKET)).toBe("foto.webp");
  });

  it("ignora query de cache", () => {
    expect(storageObjectName(`${base}foto.webp?t=123`, BUCKET)).toBe("foto.webp");
  });

  it("desfaz o escape do nome", () => {
    // A mesma imagem aparece escapada em um lugar e crua em outro; comparar a
    // URL inteira faria o arquivo passar por nao usado.
    expect(storageObjectName(`${base}foto%20nova.webp`, BUCKET)).toBe("foto nova.webp");
  });

  it("devolve null para URL de fora do bucket", () => {
    expect(storageObjectName("https://outro.site/foto.webp", BUCKET)).toBeNull();
  });
});

describe("reframedNameOf", () => {
  it("monta o nome da versao reenquadrada", () => {
    expect(reframedNameOf("abc.webp")).toBe("abc-4x5.webp");
    expect(reframedNameOf("abc.jpg")).toBe("abc-4x5.webp");
  });
});

describe("classifyMediaFiles", () => {
  const sources: UsageSource[] = [
    { kind: "produto", label: "Vitamina D3", urls: [`${base}d3-4x5.webp`] },
    { kind: "banner", label: "Banner de verao", urls: [`${base}banner.webp`] },
    { kind: "notificacao", label: "Aviso de feriado", urls: [`${base}aviso.webp`] },
  ];

  it("marca como em uso o que aparece na loja", () => {
    const [produto] = classifyMediaFiles([file("d3-4x5.webp")], sources, BUCKET);
    expect(produto.status).toBe("em-uso");
    expect(produto.usedBy).toEqual([{ kind: "produto", label: "Vitamina D3" }]);
  });

  it("conta banner e notificacao como uso", () => {
    // O bug antigo: so produtos eram considerados, entao um banner no ar
    // aparecia como sem uso, com botao de remover ao lado.
    const [banner, aviso] = classifyMediaFiles([file("banner.webp"), file("aviso.webp")], sources, BUCKET);
    expect(banner.status).toBe("em-uso");
    expect(banner.usedBy[0].kind).toBe("banner");
    expect(aviso.status).toBe("em-uso");
    expect(aviso.usedBy[0].kind).toBe("notificacao");
  });

  it("reconhece o original que a conversao 4:5 substituiu", () => {
    const [original] = classifyMediaFiles([file("d3.webp")], sources, BUCKET);
    expect(original.status).toBe("substituida");
    expect(original.replacedBy).toBe("d3-4x5.webp");
  });

  it("so chama de sem uso o que nao tem dono nem substituto", () => {
    const [solto] = classifyMediaFiles([file("teste-antigo.png")], sources, BUCKET);
    expect(solto.status).toBe("sem-uso");
    expect(solto.replacedBy).toBeNull();
  });

  it("nao repete o mesmo dono quando a imagem e capa e galeria", () => {
    const repetido: UsageSource[] = [
      { kind: "produto", label: "Whey", urls: [`${base}w.webp`, `${base}w.webp?t=2`] },
    ];
    const [arquivo] = classifyMediaFiles([file("w.webp")], repetido, BUCKET);
    expect(arquivo.usedBy).toHaveLength(1);
  });

  it("lista os dois donos quando a imagem e compartilhada", () => {
    const compartilhada: UsageSource[] = [
      { kind: "produto", label: "Cha A", urls: [`${base}c.webp`] },
      { kind: "produto", label: "Cha B", urls: [`${base}c.webp`] },
    ];
    const [arquivo] = classifyMediaFiles([file("c.webp")], compartilhada, BUCKET);
    expect(arquivo.usedBy.map((u) => u.label)).toEqual(["Cha A", "Cha B"]);
  });
});

describe("summarizeMediaFiles", () => {
  it("soma quantidade e tamanho por estado", () => {
    const sources: UsageSource[] = [{ kind: "produto", label: "P", urls: [`${base}a-4x5.webp`] }];
    const classified = classifyMediaFiles(
      [file("a-4x5.webp", 3000), file("a.webp", 2000), file("solto.webp", 500)],
      sources,
      BUCKET,
    );
    const totals = summarizeMediaFiles(classified);
    expect(totals["em-uso"]).toEqual({ count: 1, bytes: 3000 });
    expect(totals.substituida).toEqual({ count: 1, bytes: 2000 });
    expect(totals["sem-uso"]).toEqual({ count: 1, bytes: 500 });
    expect(totals.total).toEqual({ count: 3, bytes: 5500 });
  });
});
