import { supabase } from "@/integrations/supabase/client";
import { normalizeProductImageFile } from "@/lib/productImageNormalization";

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

export type UploadProductImageResult =
  | { ok: true; publicUrl: string }
  | { ok: false; message: string };

function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  const ext = file.name.split(".").pop().toLowerCase() ?? "";
  return ALLOWED_EXT.has(ext);
}

export async function uploadBlobPreviewUrl(blobUrl: string): Promise<UploadProductImageResult> {
  try {
    const res = await fetch(blobUrl);
    const blob = await res.blob();
    const file = new File([blob], `produto-${Date.now()}.jpg`, {
      type: blob.type && blob.type.startsWith("image/") ? blob.type : "image/jpeg",
    });
    return uploadProductImageFile(file);
  } catch {
    return { ok: false, message: "Não foi possível processar a imagem selecionada." };
  }
}

export async function uploadProductImageFile(file: File): Promise<UploadProductImageResult> {
  if (!isImageFile(file)) {
    return { ok: false, message: "Arquivo inválido. Selecione uma imagem (JPG, PNG ou WebP)." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, message: "Imagem muito grande. Máximo 8 MB." };
  }

  const normalizedFile = await normalizeProductImageFile(file);

  await supabase.auth.refreshSession();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) {
    return { ok: false, message: "Faça login no admin antes de enviar a foto." };
  }

  const ext = safeExtension(normalizedFile);
  const path = `${crypto.randomUUID()}.${ext}`;

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

export type DeleteImageResult =
  | { ok: true }
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
