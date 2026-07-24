const DEFAULT_TARGET_WIDTH = 1200;
const DEFAULT_TARGET_HEIGHT = 900;
const DEFAULT_QUALITY = 0.80;
const DEFAULT_FORMAT = "webp";
const WHITE_THRESHOLD = 248;
const TRANSPARENT_THRESHOLD = 8;
const CONTENT_PADDING_RATIO = 0.04;

type NormalizeProductImageOptions = {
  targetWidth?: number;
  targetHeight?: number;
  quality?: number;
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

type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

function isBackgroundPixel(r: number, g: number, b: number, a: number): boolean {
  if (a < TRANSPARENT_THRESHOLD) return true;
  return r >= WHITE_THRESHOLD && g >= WHITE_THRESHOLD && b >= WHITE_THRESHOLD;
}

function findContentBounds(imageData: ImageData): Bounds | null {
  const { data, width, height } = imageData;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const a = data[index + 3];

      if (isBackgroundPixel(r, g, b, a)) continue;

      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) return null;
  return { minX, minY, maxX, maxY };
}

function padBounds(bounds: Bounds, width: number, height: number): Bounds {
  const contentWidth = bounds.maxX - bounds.minX + 1;
  const contentHeight = bounds.maxY - bounds.minY + 1;
  const padX = Math.max(8, Math.round(contentWidth * CONTENT_PADDING_RATIO));
  const padY = Math.max(8, Math.round(contentHeight * CONTENT_PADDING_RATIO));

  return {
    minX: Math.max(0, bounds.minX - padX),
    minY: Math.max(0, bounds.minY - padY),
    maxX: Math.min(width - 1, bounds.maxX + padX),
    maxY: Math.min(height - 1, bounds.maxY + padY),
  };
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

export async function normalizeProductImageFile(
  file: File,
  options: NormalizeProductImageOptions = {},
): Promise<File> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return file;
  }

  const targetWidth = options.targetWidth ?? DEFAULT_TARGET_WIDTH;
  const targetHeight = options.targetHeight ?? DEFAULT_TARGET_HEIGHT;
  const quality = options.quality ?? DEFAULT_QUALITY;

  const sourceUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(sourceUrl);
    const sourceCanvas = document.createElement("canvas");
    const sourceCtx = sourceCanvas.getContext("2d");
    if (!sourceCtx) {
      return file;
    }

    sourceCanvas.width = image.naturalWidth;
    sourceCanvas.height = image.naturalHeight;
    sourceCtx.drawImage(image, 0, 0);

    const bounds = padBounds(
      findContentBounds(sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height)) ?? {
        minX: 0,
        minY: 0,
        maxX: sourceCanvas.width - 1,
        maxY: sourceCanvas.height - 1,
      },
      sourceCanvas.width,
      sourceCanvas.height,
    );

    const cropWidth = Math.max(1, bounds.maxX - bounds.minX + 1);
    const cropHeight = Math.max(1, bounds.maxY - bounds.minY + 1);
    const scale = Math.min(targetWidth / cropWidth, targetHeight / cropHeight);
    const drawWidth = Math.max(1, Math.round(cropWidth * scale));
    const drawHeight = Math.max(1, Math.round(cropHeight * scale));

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return file;
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    canvas.width = drawWidth;
    canvas.height = drawHeight;

    ctx.drawImage(
      sourceCanvas,
      bounds.minX,
      bounds.minY,
      cropWidth,
      cropHeight,
      0,
      0,
      drawWidth,
      drawHeight,
    );

    const blob = await canvasToBlob(canvas, `image/${DEFAULT_FORMAT}`, quality);
    if (!blob) {
      return file;
    }

    return new File([blob], `${basename(file.name)}.${DEFAULT_FORMAT}`, {
      type: `image/${DEFAULT_FORMAT}`,
      lastModified: file.lastModified,
    });
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}
