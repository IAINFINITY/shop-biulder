// Casamento de arquivos de imagem com produtos pelo codigo, para o time de
// design entregar o catalogo inteiro de uma vez.
//
// O gargalo real nao era o formulario de produto — era a unidade de trabalho.
// Reenviar 146 fotos abrindo 146 formularios e o que trava o time. O padrao de
// mercado resolve isso pelo nome do arquivo: `12336_1.webp` vai para a capa do
// produto de codigo 12336, `12336_2.webp` para a galeria.

export type BulkImageMatchStatus = "capa" | "galeria" | "sem-produto" | "invalido";

export type BulkImageMatch = {
  file: File;
  fileName: string;
  /** Codigo extraido do nome do arquivo. */
  code: string;
  /** 1 = capa, 2+ = galeria. */
  position: number;
  status: BulkImageMatchStatus;
  productId: string | null;
  productName: string | null;
  reason: string | null;
};

type MatchableProduct = {
  id: string;
  name: string;
  product_code: string | null;
};

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif"]);

export function normalizeProductCodeKey(value: string | null | undefined): string {
  return String(value ?? "").trim().toUpperCase();
}

/**
 * Le codigo e posicao a partir do nome do arquivo.
 *
 * Aceita `12336.webp`, `12336_1.webp`, `12336-2.jpg` e tolera sufixos que
 * editores costumam anexar (` (1)`, ` copy`). Sem separador, a posicao e 1.
 */
export function parseBulkImageFileName(fileName: string): { code: string; position: number } | null {
  const withoutExtension = fileName.replace(/\.[^.]+$/, "");
  const cleaned = withoutExtension
    .replace(/\s*\((\d+)\)\s*$/i, "")
    .replace(/\s*(copy|copia|cópia)\s*$/i, "")
    .trim();

  if (!cleaned) return null;

  const match = cleaned.match(/^(.+?)(?:[_-](\d{1,2}))?$/);
  if (!match) return null;

  const code = normalizeProductCodeKey(match[1]);
  if (!code) return null;

  const position = match[2] ? Number.parseInt(match[2], 10) : 1;
  return { code, position: Number.isFinite(position) && position > 0 ? position : 1 };
}

function hasImageExtension(fileName: string): boolean {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_EXTENSIONS.has(extension);
}

/**
 * Cruza os arquivos escolhidos com o catalogo.
 *
 * Nao envia nada: devolve o que aconteceria, para o admin conferir antes de
 * confirmar. Um lote errado sobrescrevendo capas seria caro de desfazer.
 */
export function matchBulkImages(files: File[], products: MatchableProduct[]): BulkImageMatch[] {
  const byCode = new Map<string, MatchableProduct>();
  for (const product of products) {
    const key = normalizeProductCodeKey(product.product_code);
    if (key) byCode.set(key, product);
  }

  return files
    .map((file): BulkImageMatch => {
      const base: Omit<BulkImageMatch, "status" | "productId" | "productName" | "reason"> & {
        code: string;
        position: number;
      } = {
        file,
        fileName: file.name,
        code: "",
        position: 1,
      };

      if (!hasImageExtension(file.name)) {
        return { ...base, status: "invalido", productId: null, productName: null, reason: "Não é imagem" };
      }

      const parsed = parseBulkImageFileName(file.name);
      if (!parsed) {
        return {
          ...base,
          status: "invalido",
          productId: null,
          productName: null,
          reason: "Nome sem código",
        };
      }

      const product = byCode.get(parsed.code);
      if (!product) {
        return {
          ...base,
          code: parsed.code,
          position: parsed.position,
          status: "sem-produto",
          productId: null,
          productName: null,
          reason: `Nenhum produto com código ${parsed.code}`,
        };
      }

      return {
        ...base,
        code: parsed.code,
        position: parsed.position,
        status: parsed.position === 1 ? "capa" : "galeria",
        productId: product.id,
        productName: product.name,
        reason: null,
      };
    })
    .sort((left, right) => left.code.localeCompare(right.code) || left.position - right.position);
}

export type BulkImageGroup = {
  productId: string;
  productName: string;
  code: string;
  matches: BulkImageMatch[];
};

/** Agrupa por produto e ordena por posicao, na ordem em que serao gravadas. */
export function groupBulkMatchesByProduct(matches: BulkImageMatch[]): BulkImageGroup[] {
  const groups = new Map<string, BulkImageGroup>();

  for (const match of matches) {
    if (!match.productId) continue;
    const existing = groups.get(match.productId);
    if (existing) {
      existing.matches.push(match);
      continue;
    }
    groups.set(match.productId, {
      productId: match.productId,
      productName: match.productName ?? "",
      code: match.code,
      matches: [match],
    });
  }

  for (const group of groups.values()) {
    group.matches.sort((left, right) => left.position - right.position);
  }

  return [...groups.values()].sort((left, right) => left.productName.localeCompare(right.productName, "pt-BR"));
}

export function summarizeBulkMatches(matches: BulkImageMatch[]) {
  return {
    total: matches.length,
    capas: matches.filter((match) => match.status === "capa").length,
    galeria: matches.filter((match) => match.status === "galeria").length,
    semProduto: matches.filter((match) => match.status === "sem-produto").length,
    invalidos: matches.filter((match) => match.status === "invalido").length,
  };
}
