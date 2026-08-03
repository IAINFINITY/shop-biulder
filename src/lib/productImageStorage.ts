import { supabase } from "@/integrations/supabase/client";
import {
  checkProductImage,
  normalizeProductImageFile,
  PRODUCT_IMAGE_FRAME,
  PRODUCT_IMAGE_MIN_SIZE,
  type ImageFrame,
} from "@/lib/productImageNormalization";

const BUCKET = "product-images";
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

const ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "webp", "gif"]);

function safeExtension(file: File): string {
  const fromName = file.name.split(".").pop().toLowerCase() ?? "";
  if (ALLOWED_EXT.has(fromName)) return fromName === "jpeg" ? "jpg" : fromName;
  const fromType = file.type.split("/")[1].toLowerCase() ?? "";
  if (ALLOWED_EXT.has(fromType)) return fromType === "jpeg" ? "webp" : fromType;
  return "webp";
}

/**
 * O campo do outro ramo aparece como opcional de proposito.
 *
 * O projeto compila com `strict: false` e `strictNullChecks: false`, e nesse modo
 * o TypeScript nao estreita uniao discriminada por booleano: mesmo dentro de
 * `if (!result.ok)` ele continua enxergando a uniao inteira, e ler `.message`
 * vira erro. Declarar os dois campos nos dois ramos resolve sem depender do
 * estreitamento — e `?: undefined` mantem a checagem util, porque atribuir
 * `message` num resultado de sucesso continua sendo erro.
 */
export type UploadProductImageResult =
  | { ok: true; publicUrl: string; message?: undefined }
  | { ok: false; publicUrl?: undefined; message: string };

function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  const ext = file.name.split(".").pop().toLowerCase() ?? "";
  return ALLOWED_EXT.has(ext);
}

export async function uploadBlobPreviewUrl(
  blobUrl: string,
  shape: UploadImageShape = { frame: PRODUCT_IMAGE_FRAME },
): Promise<UploadProductImageResult> {
  try {
    const res = await fetch(blobUrl);
    const blob = await res.blob();
    const file = new File([blob], `produto-${Date.now()}.jpg`, {
      type: blob.type && blob.type.startsWith("image/") ? blob.type : "image/jpeg",
    });
    return uploadProductImageFile(file, shape);
  } catch {
    return { ok: false, message: "Não foi possível processar a imagem selecionada." };
  }
}

/**
 * @param frame Moldura de destino. O padrao e a foto de produto; banner e
 * notificacao precisam declarar a sua, senao saem esticadas para 4:5 retrato.
 */
export type UploadImageShape =
  /** Moldura fixa: a imagem preenche exatamente esse tamanho (foto de produto). */
  | { frame: ImageFrame; quality?: number; nome?: string }
  /** Sem moldura: mantem a proporcao entregue, so reduz (banner, notificacao). */
  | { maxSize: number; quality?: number; nome?: string };

/** Nome pedido pelo chamador, limpo do que nao pode ir para um caminho. */
function nomeDeArquivo(shape: UploadImageShape): string | null {
  const bruto = "nome" in shape ? shape.nome : undefined;
  if (typeof bruto !== "string") return null;
  // Barra viraria pasta; espaco e acento viram escape na URL e quebram a
  // comparacao por nome que a biblioteca de imagens faz.
  const limpo = bruto.trim().replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "");
  return limpo || null;
}

export async function uploadProductImageFile(
  file: File,
  shape: UploadImageShape = { frame: PRODUCT_IMAGE_FRAME },
): Promise<UploadProductImageResult> {
  if (!isImageFile(file)) {
    return { ok: false, message: "Arquivo inválido. Selecione uma imagem (JPG, PNG ou WebP)." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, message: "Imagem muito grande. Máximo 8 MB." };
  }

  // Calls with a fixed frame are product photos. Keep this check next to the
  // Storage boundary so no caller can upload an undersized product image.
  if ("frame" in shape) {
    const check = await checkProductImage(file);
    if (check.dimensions && check.isTooSmall) {
      const { width, height } = check.dimensions;
      return {
        ok: false,
        message: `Foto de ${width}x${height}px: o mínimo é ${PRODUCT_IMAGE_MIN_SIZE}x${PRODUCT_IMAGE_MIN_SIZE}px. A imagem não foi enviada.`,
      };
    }
  }

  const normalizedFile = await normalizeProductImageFile(
    file,
    "frame" in shape
      ? { targetWidth: shape.frame.width, targetHeight: shape.frame.height, quality: shape.quality }
      : { maxSize: shape.maxSize, quality: shape.quality },
  );

  await supabase.auth.refreshSession();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) {
    return { ok: false, message: "Faça login no admin antes de enviar a foto." };
  }

  const ext = safeExtension(normalizedFile);
  /**
   * Nome do arquivo no bucket.
   *
   * Com `nome`, vira `12336.webp` — o codigo do produto. Sem ele, sobra o UUID.
   *
   * O UUID era o unico caminho, e o resultado era uma biblioteca inteira de
   * arquivos que ninguem conseguia identificar pelo nome. Pior: o envio em lote
   * casa arquivo com produto justamente pelo nome, entao o que ja estava no
   * storage era invisivel para ele. Ver
   * `scripts/rename-images-to-product-codes.mjs`, que arrumou o acervo antigo.
   */
  const path = `${nomeDeArquivo(shape) ?? crypto.randomUUID()}.${ext}`;

  let { error } = await supabase.storage.from(BUCKET).upload(path, normalizedFile, {
    cacheControl: "31536000",
    upsert: true,
      contentType: normalizedFile.type || `image/${ext === "jpg" ? "jpeg" : ext}`,
  });

  if (error && /already exists|duplicate|invalid/i.test(error.message)) {
    const retryPath = `uploads/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    ({ error } = await supabase.storage.from(BUCKET).upload(retryPath, normalizedFile, {
      cacheControl: "31536000",
    contentType: normalizedFile.type || `image/${ext === "jpg" ? "jpeg" : ext}`,
    }));
    if (!error) {
      const {
        data: { publicUrl },
      } = supabase.storage.from(BUCKET).getPublicUrl(retryPath);
      return { ok: true, publicUrl };
    }
  }

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("bucket") && msg.includes("not found")) {
      return {
        ok: false,
        message: 'Bucket "product-images" não existe no Supabase. Crie o bucket nas configurações de Storage.',
      };
    }
    if (msg.includes("row-level security") || msg.includes("policy")) {
      return {
        ok: false,
        message:
          "Sem permissão para enviar imagens. No Supabase, confira as políticas do bucket product-images (usuário admin autenticado).",
      };
    }
    console.error("Erro ao enviar imagem", error);
    return { ok: false, message: "Erro ao enviar imagem. Verifique sua conexão e o storage do Supabase." };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return { ok: true, publicUrl };
}

export function isBlobPreviewUrl(url: string): boolean {
  return url.startsWith("blob:");
}

function extractStoragePath(publicUrl: string): string | null {
  const marker = `/object/public/${BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return publicUrl.slice(idx + marker.length).split("?")[0];
}

export function isProductImageStorageUrl(publicUrl: string | null | undefined): boolean {
  if (!publicUrl) return false;
  return extractStoragePath(publicUrl) !== null;
}

/** Mesmo motivo de `UploadProductImageResult`. */
export type DeleteImageResult =
  | { ok: true; message?: undefined }
  | { ok: false; message: string };

export async function deleteStorageImage(publicUrl: string | null | undefined): Promise<DeleteImageResult> {
  if (!publicUrl) return { ok: true };

  const path = extractStoragePath(publicUrl);
  if (!path) return { ok: false, message: "URL inválida: não pertence ao bucket product-images." };

  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) {
    console.error("Erro ao remover imagem do storage:", error);
    return { ok: false, message: error.message };
  }

  return { ok: true };
}
