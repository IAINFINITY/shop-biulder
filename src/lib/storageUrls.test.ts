import { describe, expect, it } from "vitest";
import { normalizeStoragePublicUrl, storageObjectKey } from "@/lib/storageUrls";

const BUCKET = "product-images";
const HOST = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/$/, "") ?? "";

describe("normalizeStoragePublicUrl", () => {
  it("reescreve o host mantendo o caminho", () => {
    const url = "https://outro-projeto.supabase.co/storage/v1/object/public/product-images/7912.webp";
    expect(normalizeStoragePublicUrl(url, BUCKET)).toBe(`${HOST}/storage/v1/object/public/product-images/7912.webp`);
  });

  // A query de cache (`?v=...`) e o que faz uma foto trocada virar um recurso
  // novo para o navegador — ver `comCacheBuster` em `productImageStorage.ts`.
  // Essa funcao reescreve o host para toda imagem exibida na vitrine; se ela
  // descartasse a query no caminho, a correcao do upload nunca chegaria a
  // quem mais importa: o cliente vendo o catalogo.
  it("preserva a query de cache ao reescrever o host", () => {
    const url = "https://outro-projeto.supabase.co/storage/v1/object/public/product-images/7912.webp?v=123";
    expect(normalizeStoragePublicUrl(url, BUCKET)).toBe(
      `${HOST}/storage/v1/object/public/product-images/7912.webp?v=123`,
    );
  });

  it("preserva query e hash juntos, na ordem em que vieram", () => {
    const url = "https://x.supabase.co/storage/v1/object/public/product-images/7912.webp?v=123#foo";
    expect(normalizeStoragePublicUrl(url, BUCKET)).toBe(
      `${HOST}/storage/v1/object/public/product-images/7912.webp?v=123#foo`,
    );
  });

  it("URL sem o marcador do bucket volta sem alteração", () => {
    const url = "https://cdn-qualquer.com/foto.jpg";
    expect(normalizeStoragePublicUrl(url, BUCKET)).toBe(url);
  });
});

describe("storageObjectKey", () => {
  // A identidade para dedupe ignora a query de proposito: a mesma foto com
  // versao de cache diferente continua sendo a mesma foto.
  it("ignora a query de cache ao formar a chave", () => {
    const semQuery = "https://a.supabase.co/storage/v1/object/public/product-images/7912.webp";
    const comQuery = "https://b.supabase.co/storage/v1/object/public/product-images/7912.webp?v=999";
    expect(storageObjectKey(comQuery, BUCKET)).toBe(storageObjectKey(semQuery, BUCKET));
  });
});
