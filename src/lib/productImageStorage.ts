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
      return { ok: true, publicUrl: comCacheBuster(publicUrl) };
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

  // `upsert: true` deixa subir por cima de um caminho que ja existia — e e
  // exatamente o caso de trocar uma foto que ja estava la. Sem a query nova,
  // a URL sairia identica a de antes e o navegador nem chegaria a pedir de
  // novo ao servidor.
  return { ok: true, publicUrl: comCacheBuster(publicUrl) };
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

function publicUrlOf(objectPath: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(objectPath).data.publicUrl;
}

/**
 * Marca a URL como uma versao nova do arquivo.
 *
 * O upload grava `cacheControl: "31536000"` (1 ano) porque foto de produto e
 * conteudo estatico e vale a pena cachear agressivo — isso e o correto para
 * performance. O problema e outro: a URL publica de um caminho e sempre a
 * mesma. Quando uma foto e **substituida** — removida e trocada por outra no
 * mesmo nome, o que acontece sempre que `normalizeProductGalleryNames` renomeia
 * a galeria para a convencao por posicao no save — o arquivo no storage muda,
 * mas a URL nao. Qualquer navegador ou o CDN do Supabase que ja tenha visto
 * aquela URL antes continua servindo os bytes antigos pelo ano inteiro, porque
 * o cabeçalho diz que nao precisa checar de novo.
 *
 * A query de cache resolve isso sem abrir mao do cache longo: o caminho no
 * bucket nao muda (a convencao por codigo continua valendo para o envio em
 * lote), mas a URL persistida no banco e usada no `<img src>` muda a cada
 * upload, entao vira um recurso novo para qualquer cache. `extractStoragePath`
 * e `storageObjectKey` ja ignoram essa query ao comparar identidade — foi
 * escrito assim desde a correcao da foto duplicada, so nunca havia quem
 * gerasse a query.
 */
export function comCacheBuster(url: string): string {
  return `${url}?v=${Date.now()}`;
}

function extensionOf(objectPath: string): string {
  const dot = objectPath.lastIndexOf(".");
  return dot === -1 ? "webp" : objectPath.slice(dot + 1).toLowerCase();
}

function safeObjectName(code: string): string {
  return code.trim().replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "");
}

/**
 * Proximo nome para um upload novo, na convencao `code.webp`, `code_2.webp`...
 *
 * Usa os caminhos ja presentes na galeria para achar o maior indice usado e
 * avanca a partir dele. Sem isso, remover uma foto do meio deixaria um buraco
 * e o upload seguinte colidiria com o arquivo que ficou — a posicao final so e
 * garantida no save, por `normalizeProductGalleryNames`, mas o nome do upload
 * precisa ser seguro desde ja.
 */
export function nextProductImageObjectName(code: string, currentUrls: string[]): string | null {
  const safe = safeObjectName(code);
  if (!safe) return null;

  let maxIndex = 0;
  for (const url of currentUrls) {
    const path = extractStoragePath(url);
    if (!path) continue;
    const stem = path.replace(/\.[^./]+$/, "");
    if (stem === safe) {
      maxIndex = Math.max(maxIndex, 1);
    } else if (stem.startsWith(`${safe}_`)) {
      const suffix = stem.slice(safe.length + 1);
      if (/^\d+$/.test(suffix)) maxIndex = Math.max(maxIndex, Number(suffix));
    }
  }

  return maxIndex === 0 ? safe : `${safe}_${maxIndex + 1}`;
}

/** Mesmo motivo de `UploadProductImageResult`. */
export type NormalizeGalleryResult =
  | { ok: true; urls: string[]; message?: undefined }
  | { ok: false; urls?: undefined; message: string };

/**
 * Renomeia a galeria inteira para casar o nome com a posicao final.
 *
 * `code.webp` para a capa, `code_2.webp` para a segunda foto, e assim por
 * diante, na ordem em que a lista chega. E o que mantem a convencao valendo
 * depois de remover uma foto do meio ou reordenar: o nome acompanha a posicao,
 * nao a ordem em que os arquivos foram enviados.
 *
 * A ordem importa. Mover um arquivo para o alvo de outro (por exemplo
 * `code_3.webp` -> `code_2.webp` quando a segunda foto sai) sobrescreveria o
 * destino. Por isso cada arquivo vai primeiro para um nome temporario e so
 * depois para o alvo final; se qualquer passo falhar, tudo volta ao estado
 * anterior.
 */
export async function normalizeProductGalleryNames(code: string, urls: string[]): Promise<NormalizeGalleryResult> {
  const safe = safeObjectName(code);
  if (!safe) return { ok: true, urls };

  const plan: Array<{ url: string; current: string; target: string }> = [];
  for (let index = 0; index < urls.length; index += 1) {
    const url = urls[index];
    const current = extractStoragePath(url);
    if (!current) continue;
    const target = `${safe}${index === 0 ? "" : `_${index + 1}`}.${extensionOf(current)}`;
    plan.push({ url, current, target });
  }

  const pending = plan.filter((m) => m.current !== m.target);
  if (pending.length === 0) return { ok: true, urls };

  const temp: Record<string, string> = {};
  for (const m of pending) temp[m.current] = `${Date.now()}-${crypto.randomUUID()}-tmp.${extensionOf(m.current)}`;

  const done: Array<{ current: string; temp: string; target: string }> = [];

  try {
    // Fase 1: para um nome temporario, liberando todos os alvos ao mesmo tempo.
    for (const m of pending) {
      const { error } = await supabase.storage.from(BUCKET).move(m.current, temp[m.current]);
      if (error) throw new Error(`mover ${m.current}: ${error.message}`);
    }

    // Fase 2: do temporario para o alvo final. Nenhum alvo esta ocupado agora,
    // entao nao ha risco de sobrescrever o arquivo de outra posicao.
    for (const m of pending) {
      const { error } = await supabase.storage.from(BUCKET).move(temp[m.current], m.target);
      if (error) throw new Error(`mover ${temp[m.current]}: ${error.message}`);
      done.push({ current: m.current, temp: temp[m.current], target: m.target });
    }
  } catch (err) {
    // Desfaz o que ja moveu, da fase 2 de volta ao temporario e da fase 1 de
    // volta ao original.
    for (const m of [...done].reverse()) {
      await supabase.storage.from(BUCKET).move(m.target, m.temp);
    }
    for (const m of pending) {
      if (done.some((d) => d.current === m.current)) continue;
      await supabase.storage.from(BUCKET).move(temp[m.current], m.current);
    }
    return {
      ok: false,
      message: `Não foi possível renomear as fotos: ${err instanceof Error ? err.message : "erro desconhecido"}`,
    };
  }

  const moved = new Map(plan.map((m) => [m.current, m.target]));
  return {
    ok: true,
    urls: urls.map((url) => {
      const current = extractStoragePath(url);
      const target = current ? moved.get(current) : null;

      // So gera URL nova para quem de fato trocou de caminho. E exatamente
      // aqui que uma foto pode pousar num nome que ate agora tinha conteudo
      // diferente em cache — por exemplo, a foto nova assumindo o lugar de
      // uma removida (`code_3.webp` ja existia com outra imagem). Sem a
      // query nova, o navegador nunca saberia que precisa buscar de novo.
      //
      // Quem nao mudou de posicao mantem a URL como chegou, cache buster
      // incluso se ja tinha um — reescrever para a URL crua aqui jogaria fora
      // a marca de versao de uma foto que acabou de ser trocada sem mudar de
      // posicao (upload que ja nasceu no nome final).
      if (!target || target === current) return url;
      return comCacheBuster(publicUrlOf(target));
    }),
  };
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
