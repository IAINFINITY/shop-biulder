// Preparo da foto de produto antes de subir para o storage.
//
// A versao anterior varria a imagem pixel a pixel, tratava como "fundo" tudo que
// fosse quase branco (RGB >= 248) ou transparente, e RECORTAVA no bounding box do
// que sobrasse. Isso destruia o enquadramento entregue pelo time de design:
//
//   - fundo de estudio em gradiente nao e branco puro, entao parte dele
//     sobrevivia ao corte e virava uma borda dura — o efeito de "recortado";
//   - a sombra do produto entrava no bounding box e desalinhava a margem;
//   - a proporcao final variava a cada foto, entao cada produto aparecia num
//     tamanho diferente dentro do card;
//   - era irreversivel: o arquivo original nunca era guardado.
//
// O trabalho agora e outro: entregar o arquivo ja no formato do quadro do
// catalogo (4:5), reduzido e em WebP.
//
// O motivo e o problema de "a foto tem fundo proprio, mas o site e branco".
// Enquanto o arquivo chega numa proporcao qualquer, sobra faixa vazia dentro da
// moldura e aparece a emenda entre o fundo da foto e o fundo da pagina. Resolver
// isso no CSS e remendo: ou corta o produto, ou inventa um fundo que nao e o da
// foto. Resolvido aqui, o arquivo ocupa o quadro inteiro por construcao e a
// vitrine so precisa exibir.
//
// A faixa que sobra e preenchida esticando a propria borda da foto — nao uma cor
// chapada. Fundo de estudio quase nunca e liso: tem gradiente ou vinheta, e uma
// cor media deixaria um degrau visivel onde a foto termina. Esticar a ultima
// coluna (ou linha) de pixels continua o gradiente na mesma direcao, entao a
// emenda deixa de existir. Nada do produto e cortado: a foto entra inteira e so
// o entorno e estendido.
//
// Referencia do formato: padrao de e-commerce (Amazon, Mercado Livre, Shopify) —
// 1:1, 1600px no maior lado, minimo de 1000px, fundo branco puro para packshot.

/** Abaixo disso a foto fica ruim no zoom da galeria. */
export const PRODUCT_IMAGE_MIN_SIZE = 1000;

/**
 * Proporcao das molduras de produto no catalogo: 4:5 retrato.
 *
 * O padrao 1:1 da Amazon existe porque marketplace generico recebe produto de
 * qualquer formato. Aqui o catalogo e inteiro de pote, lata e caixa — formatos
 * verticais. Medindo as fotos atuais, a proporcao media ficou em torno de 0,77,
 * quase 4:5: num quadro quadrado sobrava ~23% de largura vazia dos dois lados, e
 * era isso que fazia o produto parecer pequeno dentro de um fundo grande.
 *
 * 4:5 tambem e o formato da referencia aprovada pelo cliente (Essential
 * Nutrition entrega em 1308x1636).
 */
export const PRODUCT_IMAGE_ASPECT_RATIO = 4 / 5;

/** Dimensoes recomendadas da foto de produto entregue pelo time de design. */
export const PRODUCT_IMAGE_TARGET_WIDTH = 1280;
export const PRODUCT_IMAGE_TARGET_HEIGHT = 1600;

export type ImageFrame = { width: number; height: number };

/**
 * Moldura da foto de produto. Aqui a moldura e imposta de proposito: o card tem
 * tamanho fixo e a foto precisa preenche-lo, senao volta a emenda entre o fundo
 * da foto e o fundo branco da pagina.
 */
export const PRODUCT_IMAGE_FRAME: ImageFrame = { width: 1280, height: 1600 };

/**
 * Banner e notificacao nao tem moldura imposta — so um teto de tamanho.
 *
 * A arte e desenhada inteira pelo time de design, e forcar uma proporcao no
 * upload esticaria a borda de uma peca que ja esta certa. Enquadrar e decisao da
 * tela; o arquivo guarda o que foi entregue.
 *
 * Teto de reserva para banner, quando a area nao e conhecida.
 *
 * Cada area tem a sua medida em `bannerSlots.ts`, e o admin passa a medida da
 * area escolhida no lugar deste numero. Este valor cobre a maior delas.
 *
 * Era 1920, com a justificativa de que "em 1920 a arte cabe inteira, sem corte e
 * sem ampliacao". Isso estava errado: o banner do topo vai de borda a borda
 * (`w-screen`), entao numa tela de 2560 a arte de 1920 era ampliada em 33%. Pior,
 * o teto derrubava para 1920 as pecas que a especificacao pede em 3840 — o
 * destaque e a faixa nunca conseguiam chegar na propria medida pelo admin.
 */
export const BANNER_IMAGE_MAX_SIZE = 3840;
export const NOTIFICATION_IMAGE_MAX_SIZE = 1600;

/**
 * Qualidade do WebP do banner.
 *
 * Estava em 0,92 por suposicao — "banner tem texto, entao comprime menos". A
 * medicao no arquivo oficial de 1920x600 mostrou o contrario: de 0,85 para 0,92
 * o arquivo cresce 44% (269 KB para 387 KB) e o erro por pixel cai so 10%. O
 * ganho nao aparece na tela, e o custo aparece no tempo de carregamento da
 * primeira imagem da home.
 *
 * Quem entrega qualidade aqui e o AVIF, gerado a parte: no mesmo arquivo ele sai
 * menor que este WebP e com um terco menos de erro.
 */
export const BANNER_IMAGE_QUALITY = 0.85;

const DEFAULT_QUALITY = 0.85;
const DEFAULT_FORMAT = "webp";

type NormalizeProductImageOptions = {
  /** Moldura fixa: a imagem preenche exatamente esse tamanho. */
  targetWidth?: number;
  targetHeight?: number;
  /** Sem moldura: so reduz para caber neste limite, mantendo a proporcao. */
  maxSize?: number;
  quality?: number;
};

export type ProductImageDimensions = {
  width: number;
  height: number;
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Não foi possível carregar a imagem para normalização."));
    image.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

function basename(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^.]+$/, "");
  return withoutExtension.trim() || `produto-${Date.now()}`;
}

/** Le as dimensoes reais do arquivo, para o admin poder validar antes de subir. */
export async function readImageDimensions(file: File): Promise<ProductImageDimensions | null> {
  if (typeof window === "undefined" || typeof document === "undefined") return null;

  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(sourceUrl);
    return { width: image.naturalWidth, height: image.naturalHeight };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

export type ProductImageCheck = {
  dimensions: ProductImageDimensions | null;
  /** Menor que o minimo recomendado: fica borrada ao ampliar. */
  isTooSmall: boolean;
  /** Fora do quadrado: vai sobrar margem na moldura 1:1 do catalogo. */
  isOffAspectRatio: boolean;
};

export async function checkProductImage(file: File): Promise<ProductImageCheck> {
  const dimensions = await readImageDimensions(file);
  if (!dimensions || dimensions.width === 0 || dimensions.height === 0) {
    return { dimensions, isTooSmall: false, isOffAspectRatio: false };
  }

  const ratio = dimensions.width / dimensions.height;
  return {
    dimensions,
    isTooSmall:
      Math.min(dimensions.width, dimensions.height) < PRODUCT_IMAGE_MIN_SIZE,
    // 8% de tolerancia: diferenca menor que isso nao se percebe na moldura.
    isOffAspectRatio: Math.abs(ratio - PRODUCT_IMAGE_ASPECT_RATIO) > 0.08,
  };
}

/**
 * Entrega a foto no quadro 4:5 do catalogo, em WebP.
 *
 * A foto entra inteira, sem corte, e o entorno que sobra e preenchido com a
 * propria borda dela esticada — ver a nota no topo do arquivo. Uma foto que ja
 * chega em 4:5 passa direto: nao sobra entorno para preencher.
 */
export async function normalizeProductImageFile(
  file: File,
  options: NormalizeProductImageOptions = {},
): Promise<File> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return file;
  }

  const maxSize = options.maxSize ?? null;
  const targetWidth = options.targetWidth ?? PRODUCT_IMAGE_TARGET_WIDTH;
  const targetHeight = options.targetHeight ?? PRODUCT_IMAGE_TARGET_HEIGHT;
  const quality = options.quality ?? DEFAULT_QUALITY;

  const sourceUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(sourceUrl);
    const sourceWidth = image.naturalWidth;
    const sourceHeight = image.naturalHeight;
    if (sourceWidth === 0 || sourceHeight === 0) return file;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    // Sem moldura: mantem a proporcao entregue e so reduz se passar do teto.
    // Nunca amplia — subir a resolucao de um arquivo pequeno so engorda o
    // arquivo sem devolver detalhe.
    if (maxSize !== null) {
      const shrink = Math.min(1, maxSize / Math.max(sourceWidth, sourceHeight));
      canvas.width = Math.max(1, Math.round(sourceWidth * shrink));
      canvas.height = Math.max(1, Math.round(sourceHeight * shrink));
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

      const fitted = await canvasToBlob(canvas, `image/${DEFAULT_FORMAT}`, quality);
      if (!fitted) return file;
      if (fitted.size >= file.size && shrink === 1) return file;
      return new File([fitted], `${basename(file.name)}.${DEFAULT_FORMAT}`, {
        type: `image/${DEFAULT_FORMAT}`,
        lastModified: file.lastModified,
      });
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // A foto cabe inteira dentro do quadro: o menor dos dois fatores manda.
    // Ampliar uma foto pequena nao cria detalhe, mas aqui e necessario para o
    // quadro fechar — quem barra foto de resolucao baixa e o aviso do admin,
    // antes de chegar neste ponto.
    const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
    const drawWidth = Math.max(1, Math.round(sourceWidth * scale));
    const drawHeight = Math.max(1, Math.round(sourceHeight * scale));
    const offsetX = Math.round((targetWidth - drawWidth) / 2);
    const offsetY = Math.round((targetHeight - drawHeight) / 2);

    ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);

    // Estende as bordas para o vazio. A fonte e o proprio canvas, ja com a foto
    // desenhada, entao o que se estica e o pixel exato da margem da foto.
    // So um dos eixos tem sobra: a escala foi escolhida para encostar no outro.
    if (offsetX > 0) {
      ctx.drawImage(canvas, offsetX, offsetY, 1, drawHeight, 0, offsetY, offsetX, drawHeight);
      const rightEdge = offsetX + drawWidth;
      ctx.drawImage(canvas, rightEdge - 1, offsetY, 1, drawHeight, rightEdge, offsetY, targetWidth - rightEdge, drawHeight);
    }
    if (offsetY > 0) {
      ctx.drawImage(canvas, 0, offsetY, targetWidth, 1, 0, 0, targetWidth, offsetY);
      const bottomEdge = offsetY + drawHeight;
      ctx.drawImage(canvas, 0, bottomEdge - 1, targetWidth, 1, 0, bottomEdge, targetWidth, targetHeight - bottomEdge);
    }

    const blob = await canvasToBlob(canvas, `image/${DEFAULT_FORMAT}`, quality);
    if (!blob) return file;

    return new File([blob], `${basename(file.name)}.${DEFAULT_FORMAT}`, {
      type: `image/${DEFAULT_FORMAT}`,
      lastModified: file.lastModified,
    });
  } catch {
    // Formato exotico que o canvas nao decodifica: sobe o original.
    return file;
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}
