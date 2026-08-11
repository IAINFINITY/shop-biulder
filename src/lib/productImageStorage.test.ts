import { describe, expect, it } from "vitest";

import {
  comCacheBuster,
  nextProductImageObjectName,
  planejarRenomeioDaGaleria,
} from "@/lib/productImageStorage";

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

describe("planejarRenomeioDaGaleria", () => {
  const alvos = (code: string, urls: string[]) =>
    planejarRenomeioDaGaleria(code, urls).plano.map((m) => `${m.current} -> ${m.target}`);

  it("o nome acompanha a posição, não a ordem de envio", () => {
    // Reordenação simples: a foto que estava em terceiro vira a capa.
    expect(alvos("7912", [URL("7912_3.webp"), URL("7912.webp"), URL("7912_2.webp")])).toEqual([
      "7912_3.webp -> 7912.webp",
      "7912.webp -> 7912_2.webp",
      "7912_2.webp -> 7912_3.webp",
    ]);
  });

  it("trocar duas fotos faz cada uma querer o nome que a outra tem agora", () => {
    /**
     * O caso que mais assusta, e o que a reordenação produz o tempo todo.
     *
     * `7912.webp` quer virar `7912_2.webp` — que **existe e é a outra foto**. Se
     * os dois movimentos fossem executados direto, na ordem, o primeiro
     * sobrescreveria o arquivo que o segundo ainda precisa ler, e o produto
     * ficaria com a mesma imagem duas vezes: uma foto desaparece sem erro
     * nenhum.
     *
     * Este teste fixa o formato do plano; quem executa resolve com um nome
     * temporário no meio, e é isso que o teste seguinte cobra.
     */
    const { pendentes } = planejarRenomeioDaGaleria("7912", [URL("7912_2.webp"), URL("7912.webp")]);

    const destinos = new Set(pendentes.map((m) => m.target));
    const origens = new Set(pendentes.map((m) => m.current));
    const colidem = [...destinos].filter((t) => origens.has(t));

    expect(colidem.length).toBeGreaterThan(0);
  });

  it("quem já está no lugar certo não é movido", () => {
    // Salvar sem mexer em nada não pode gerar tráfego de storage — e cada
    // movimento é uma chance de falhar no meio.
    const { pendentes } = planejarRenomeioDaGaleria("7912", [URL("7912.webp"), URL("7912_2.webp")]);
    expect(pendentes).toEqual([]);
  });

  it("remover a foto do meio fecha o buraco na numeração", () => {
    expect(alvos("7912", [URL("7912.webp"), URL("7912_3.webp")])).toEqual([
      "7912.webp -> 7912.webp",
      "7912_3.webp -> 7912_2.webp",
    ]);
  });

  it("preserva a extensão de cada arquivo", () => {
    // Galeria misturada existe: fotos antigas em jpg e novas em webp. Forçar
    // `.webp` no nome faria o caminho apontar para um arquivo inexistente.
    expect(alvos("51", [URL("outra.jpg"), URL("51.webp")])).toEqual([
      "outra.jpg -> 51.jpg",
      "51.webp -> 51_2.webp",
    ]);
  });

  it("URL de fora do bucket não é renomeada, mas ainda ocupa a posição dela", () => {
    /**
     * Escrevi este teste esperando `7912.webp` e ele falhou apontando
     * `7912_2.webp`. O código está certo e a expectativa é que estava errada,
     * então fica registrado o porquê.
     *
     * A foto de fora do bucket não pode ser movida — não é nossa. Mas ela
     * **está** na galeria, e é a capa. Se a foto seguinte assumisse o nome
     * `7912.webp`, o nome passaria a mentir: diria "capa" sobre a segunda foto.
     * A numeração acompanha a posição no site, e não a quantidade de arquivos
     * que por acaso moram no nosso storage.
     */
    const { plano } = planejarRenomeioDaGaleria("7912", ["https://cdn-externo/foto.jpg", URL("7912_5.webp")]);
    expect(plano).toHaveLength(1);
    expect(plano[0].target).toBe("7912_2.webp");
  });

  it("sem código do produto não renomeia nada", () => {
    expect(planejarRenomeioDaGaleria("", [URL("7912.webp")]).plano).toEqual([]);
  });
});
