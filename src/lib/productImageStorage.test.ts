import { describe, expect, it } from "vitest";

import { comCacheBuster, nextProductImageObjectName } from "@/lib/productImageStorage";

const URL = (name: string) => `https://projeto.supabase.co/storage/v1/object/public/product-images/${name}`;

describe("nextProductImageObjectName", () => {
  it("retorna o código para a primeira foto", () => {
    expect(nextProductImageObjectName("7912", [])).toBe("7912");
  });

  it("avança pelo maior índice já usado", () => {
    const urls = [URL("7912.webp"), URL("7912_2.webp"), URL("7912_3.webp")];
    expect(nextProductImageObjectName("7912", urls)).toBe("7912_4");
  });

  it("não recomeça numeração após remover a foto do meio", () => {
    // `7912_2.webp` saiu da galeria; o próximo upload não pode sobrescrever o
    // `7912_3.webp` que ficou — o save normaliza depois.
    const urls = [URL("7912.webp"), URL("7912_3.webp")];
    expect(nextProductImageObjectName("7912", urls)).toBe("7912_4");
  });

  it("ignora URLs fora do bucket", () => {
    const urls = ["https://outro-cdn/imagem.jpg", URL("51.webp")];
    expect(nextProductImageObjectName("51", urls)).toBe("51_2");
  });

  it("retorna null sem código", () => {
    expect(nextProductImageObjectName("", [URL("51.webp")])).toBeNull();
    expect(nextProductImageObjectName("   ", [])).toBeNull();
  });
});

describe("comCacheBuster", () => {
  // Cobre o bug relatado: trocar uma foto que já existia não atualizava em
  // lugar nenhum, porque a URL do caminho não muda quando o storage aceita
  // `upsert: true` — e o cache de um ano fazia o navegador nunca checar de
  // novo. `extractStoragePath` e `storageObjectKey` já ignoravam essa query
  // ao comparar identidade; só faltava alguém gerando uma.
  it("acrescenta uma query, sem tocar no caminho", () => {
    const url = URL("7912_3.webp");
    const result = comCacheBuster(url);
    expect(result).toMatch(/^https:\/\/projeto\.supabase\.co\/storage\/v1\/object\/public\/product-images\/7912_3\.webp\?v=\d+$/);
    expect(nextProductImageObjectName("7912", [result])).toBe("7912_4");
  });
});
