import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { PRODUCT_DESCRIPTION_PROSE } from "@/lib/productDescriptionStyles";
import {
  extractDescriptionBlocks,
  extractDescriptionPreview,
  hasAuthoredStructure,
  sanitizeRichText,
  stripHtml,
} from "@/lib/richTextPure";

type ProductDescriptionProps = {
  html: string;
  className?: string;
  plainPreview?: boolean;
  lineClamp?: 1 | 2 | 3;
};

/**
 * Descricao do produto.
 *
 * Dois caminhos, decididos por `hasAuthoredStructure`:
 *
 * - descricao formatada no editor do admin sai como veio, so higienizada. Foi
 *   alguem que decidiu onde vai titulo, negrito e lista numerada — reinterpretar
 *   isso so destroi o trabalho;
 * - texto corrido de sistema antigo passa pela inferencia de blocos, que separa
 *   paragrafo e lista a partir das quebras de linha.
 */
export function ProductDescription({
  html,
  className,
  plainPreview = false,
  lineClamp,
}: ProductDescriptionProps) {
  const plain = useMemo(() => stripHtml(html), [html]);
  const authored = useMemo(() => hasAuthoredStructure(html), [html]);
  const sanitized = useMemo(() => (authored ? sanitizeRichText(html) : ""), [authored, html]);
  const previewText = useMemo(
    () => (plainPreview ? extractDescriptionPreview(html) : ""),
    [plainPreview, html],
  );
  const blocks = useMemo(
    () => (!plainPreview && !authored ? extractDescriptionBlocks(html) : []),
    [plainPreview, authored, html],
  );

  if (!plain) return null;

  if (plainPreview) {
    return (
      <p
        className={cn(
          "text-muted-foreground leading-relaxed",
          lineClamp === 1 && "line-clamp-1",
          lineClamp === 2 && "line-clamp-2",
          lineClamp === 3 && "line-clamp-3",
          className,
        )}
      >
        {previewText || plain}
      </p>
    );
  }

  if (authored) {
    return (
      <div
        className={cn(PRODUCT_DESCRIPTION_PROSE, className)}
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
    );
  }

  if (blocks.length > 0) {
    return (
      <div className={cn("space-y-4 text-foreground/90", className)}>
        {blocks.map((block, index) =>
          block.type === "paragraph" ? (
            <p key={`paragraph-${index}`} className="leading-8 text-foreground/85">
              {block.text}
            </p>
          ) : (
            <ul
              key={`list-${index}`}
              className="list-disc space-y-3 pl-5 leading-8 text-foreground/85 marker:text-primary"
            >
              {block.items.map((item, itemIndex) => (
                <li key={`item-${index}-${itemIndex}`}>{item}</li>
              ))}
            </ul>
          ),
        )}
      </div>
    );
  }

  return <p className={cn("text-muted-foreground leading-relaxed", className)}>{plain}</p>;
}
