/**
 * Classificacao dos arquivos do storage para a biblioteca de midia.
 *
 * A versao anterior olhava so os produtos, e isso dava dois problemas serios:
 *
 * - banner e notificacao usam o mesmo bucket, entao um banner no ar aparecia
 *   como "sem uso" — com botao de remover ao lado. Bastava um clique para
 *   derrubar a imagem da home;
 * - depois da conversao das fotos para 4:5, o arquivo original ficou no storage
 *   sem ser referenciado. Sao 157 arquivos visualmente identicos aos que estao
 *   em uso, entao "sem uso" parecia erro do sistema.
 *
 * Aqui cada arquivo recebe um estado que diz o que fazer com ele, em vez de um
 * "sim ou nao" que obriga a adivinhar.
 */

export type MediaUsageKind = "produto" | "banner" | "notificacao";

export type MediaUsage = {
  kind: MediaUsageKind;
  label: string;
};

export type MediaStatus =
  /** Aparece em algum lugar da loja. Nao pode ser removido. */
  | "em-uso"
  /** Original de uma foto que foi reenquadrada. A versao nova e que esta no ar. */
  | "substituida"
  /** Nao aparece em lugar nenhum: sobra de troca de foto ou produto excluido. */
  | "sem-uso";

export type MediaFileInput = {
  name: string;
  publicUrl: string;
  sizeBytes: number | null;
  createdAt: string | null;
};

export type ClassifiedMediaFile = MediaFileInput & {
  status: MediaStatus;
  usedBy: MediaUsage[];
  /** Nome do arquivo que substituiu este. So para `substituida`. */
  replacedBy: string | null;
};

/**
 * Nome do arquivo dentro do bucket, a partir da URL publica.
 *
 * Comparar URL inteira nao serve: a mesma imagem aparece ora com query de cache,
 * ora com caracteres escapados de forma diferente, e qualquer diferenca faria o
 * arquivo passar por nao usado.
 */
export function storageObjectName(url: string, bucket: string): string | null {
  if (typeof url !== "string") return null;
  const marker = `/${bucket}/`;
  const index = url.indexOf(marker);
  if (index < 0) return null;
  const raw = url.slice(index + marker.length).split("?")[0].split("#")[0];
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Sufixo que a conversao para 4:5 acrescenta ao nome do arquivo. */
const REFRAMED_SUFFIX = "-4x5.webp";

/** Nome que a versao reenquadrada deste arquivo teria. */
export function reframedNameOf(name: string): string {
  return `${name.replace(/\.[^./]+$/, "")}${REFRAMED_SUFFIX}`;
}

export type UsageSource = {
  kind: MediaUsageKind;
  /** Nome legivel do dono: produto, banner ou notificacao. */
  label: string;
  urls: readonly (string | null | undefined)[];
};

export function classifyMediaFiles(
  files: readonly MediaFileInput[],
  sources: readonly UsageSource[],
  bucket: string,
): ClassifiedMediaFile[] {
  const usage = new Map<string, MediaUsage[]>();

  for (const source of sources) {
    for (const url of source.urls) {
      if (typeof url !== "string") continue;
      const name = storageObjectName(url, bucket);
      if (!name) continue;
      const list = usage.get(name) ?? [];
      // O mesmo dono pode listar a imagem duas vezes (capa e galeria).
      if (list.some((item) => item.kind === source.kind && item.label === source.label)) continue;
      list.push({ kind: source.kind, label: source.label });
      usage.set(name, list);
    }
  }

  return files.map((file) => {
    const usedBy = usage.get(file.name) ?? [];
    if (usedBy.length > 0) {
      return { ...file, status: "em-uso" as const, usedBy, replacedBy: null };
    }

    const reframed = reframedNameOf(file.name);
    if (reframed !== file.name && usage.has(reframed)) {
      return { ...file, status: "substituida" as const, usedBy: [], replacedBy: reframed };
    }

    return { ...file, status: "sem-uso" as const, usedBy: [], replacedBy: null };
  });
}

export function summarizeMediaFiles(files: readonly ClassifiedMediaFile[]) {
  const empty = { count: 0, bytes: 0 };
  const totals: Record<MediaStatus | "total", { count: number; bytes: number }> = {
    "em-uso": { ...empty },
    substituida: { ...empty },
    "sem-uso": { ...empty },
    total: { ...empty },
  };

  for (const file of files) {
    const bytes = file.sizeBytes ?? 0;
    totals[file.status].count += 1;
    totals[file.status].bytes += bytes;
    totals.total.count += 1;
    totals.total.bytes += bytes;
  }

  return totals;
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
