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
    description: 1200,
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
