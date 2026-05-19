import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { sanitizeRichText, stripHtml } from "@/lib/richText";

type ProductDescriptionProps = {
  html: string;
  className?: string;
  /** Em listas: mostra só texto sem formatação, com reticências. */
  plainPreview?: boolean;
  lineClamp?: 2 | 3;
};

export function ProductDescription({
  html,
  className,
  plainPreview = false,
  lineClamp,
}: ProductDescriptionProps) {
  const hasHtml = html.includes("<");
  const plain = useMemo(() => stripHtml(html), [html]);
  const sanitized = useMemo(() => sanitizeRichText(html), [html]);

  if (!plain) return null;

  if (plainPreview || !hasHtml) {
    return (
      <p
        className={cn(
          "text-muted-foreground leading-relaxed",
          lineClamp === 2 && "line-clamp-2",
          lineClamp === 3 && "line-clamp-3",
          className,
        )}
      >
        {plain}
      </p>
    );
  }

  return (
    <div
      className={cn(
        "prose prose-sm max-w-none text-muted-foreground",
        "prose-headings:text-foreground prose-headings:font-semibold",
        "prose-p:leading-relaxed prose-strong:text-foreground prose-strong:font-semibold",
        "[&_u]:underline [&_s]:line-through",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
