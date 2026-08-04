import { describe, expect, it } from "vitest";

import { nextProductImageObjectName } from "@/lib/productImageStorage";

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
