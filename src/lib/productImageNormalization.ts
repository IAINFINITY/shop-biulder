const DEFAULT_TARGET_WIDTH = 1200;
const DEFAULT_TARGET_HEIGHT = 900;
const DEFAULT_BACKGROUND = "#ffffff";
const DEFAULT_QUALITY = 0.92;

type NormalizeProductImageOptions = {
  targetWidth?: number;
  targetHeight?: number;
  background?: string;
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
  const background = options.background ?? DEFAULT_BACKGROUND;
  const quality = options.quality ?? DEFAULT_QUALITY;

  const sourceUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(sourceUrl);
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return file;
    }

    ctx.fillStyle = background;
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    const scale = Math.min(targetWidth / image.naturalWidth, targetHeight / image.naturalHeight);
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    const dx = (targetWidth - drawWidth) / 2;
    const dy = (targetHeight - drawHeight) / 2;

    ctx.drawImage(image, dx, dy, drawWidth, drawHeight);

    const blob = await canvasToBlob(canvas, "image/jpeg", quality);
    if (!blob) {
      return file;
    }

    return new File([blob], `${basename(file.name)}.jpg`, {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}
