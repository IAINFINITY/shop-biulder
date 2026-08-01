/**
 * Encaixa a foto inteira no quadro 4:5 e estende a borda para o que sobrar.
 *
 * Espelha `normalizeProductImageFile` do app: e o mesmo tratamento que o upload
 * faz no navegador, aqui em sharp para poder rodar sobre o que ja esta no
 * storage. Se os dois divergirem, a foto reenviada pelo admin passa a nao bater
 * com a que o script gerou.
 */
import sharp from "sharp";

export const TARGET_WIDTH = 1280;
export const TARGET_HEIGHT = 1600;
const QUALITY = 85;

/**
 * Encaixa a foto inteira no quadro e estende a borda para o que sobrar.
 *
 * Espelha `normalizeProductImageFile`: a faixa vazia recebe a ultima coluna (ou
 * linha) de pixels esticada, nao uma cor chapada — fundo de estudio tem
 * gradiente, e cor chapada deixaria degrau onde a foto termina.
 */
export async function fillToFrame(input) {
  const fitted = await sharp(input)
    .resize(TARGET_WIDTH, TARGET_HEIGHT, { fit: "inside" })
    .toBuffer({ resolveWithObject: true });

  const { width, height } = fitted.info;
  if (width === TARGET_WIDTH && height === TARGET_HEIGHT) {
    return sharp(fitted.data).webp({ quality: QUALITY }).toBuffer();
  }

  const left = Math.floor((TARGET_WIDTH - width) / 2);
  const top = Math.floor((TARGET_HEIGHT - height) / 2);
  const layers = [{ input: fitted.data, left, top }];

  const stretch = (extract, resize) =>
    sharp(fitted.data).extract(extract).resize({ ...resize, fit: "fill" }).toBuffer();

  if (left > 0) {
    const right = TARGET_WIDTH - width - left;
    layers.unshift(
      { input: await stretch({ left: 0, top: 0, width: 1, height }, { width: left, height }), left: 0, top },
      {
        input: await stretch({ left: width - 1, top: 0, width: 1, height }, { width: right, height }),
        left: left + width,
        top,
      },
    );
  }
  if (top > 0) {
    // Estende a partir da faixa ja completa em largura, para o canto herdar a
    // continuacao correta em vez de ficar com um bloco solto.
    const bottom = TARGET_HEIGHT - height - top;
    const band = await sharp({
      create: { width: TARGET_WIDTH, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite(layers.map((layer) => ({ ...layer, top: 0 })))
      .png()
      .toBuffer();

    const stretchBand = (extractTop, targetHeight) =>
      sharp(band)
        .extract({ left: 0, top: extractTop, width: TARGET_WIDTH, height: 1 })
        .resize({ width: TARGET_WIDTH, height: targetHeight, fit: "fill" })
        .toBuffer();

    layers.push(
      { input: await stretchBand(0, top), left: 0, top: 0 },
      { input: await stretchBand(height - 1, bottom), left: 0, top: top + height },
    );
  }

  return sharp({
    create: { width: TARGET_WIDTH, height: TARGET_HEIGHT, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  })
    .composite(layers)
    .webp({ quality: QUALITY })
    .toBuffer();
}
