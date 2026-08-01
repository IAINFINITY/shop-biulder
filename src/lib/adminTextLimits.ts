export const ADMIN_TEXT_LIMITS = {
  notifications: {
    title: 80,
    summary: 120,
    body: 320,
    ctaLabel: 32,
    ctaUrl: 180,
  },
  banners: {
    label: 70,
    linkUrl: 180,
  },
  products: {
    name: 80,
    code: 24,
    // As descricoes novas, escritas pelo time de design, passam de 5.000
    // caracteres — a maior tem 5.889. Com o limite antigo de 1.200 o contador
    // aparecia em "4820/1200", como se o texto estivesse errado. O numero aqui
    // e um teto de sanidade, nao uma regra de estilo: o que segura o tamanho e
    // a revisao de quem escreve.
    description: 8000,
  },
} as const;

export function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function countPlainTextCharacters(value: string): number {
  return value.length;
}

export function countRichTextCharacters(value: string): number {
  return stripHtmlTags(value).length;
}
