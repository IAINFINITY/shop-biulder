import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { extractDescriptionBlocks, sanitizeRichText, stripHtml } from "@/lib/richText";

type ProductDescriptionProps = {
  html: string;
  className?: string;
  plainPreview?: boolean;
  lineClamp?: 1 | 2 | 3;
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
  const descriptionBlocks = useMemo(() => extractDescriptionBlocks(html), [html]);

  if (!plain) return null;

  if (plainPreview) {
    const previewText = descriptionBlocks[0]
      ? descriptionBlocks[0].type === "paragraph"
        ? descriptionBlocks[0].text
        : descriptionBlocks[0].items.join(" ")
      : plain;

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
        {previewText}
      </p>
    );
  }

  if (!hasHtml) {
    if (descriptionBlocks.length > 0) {
      return (
        <div className={cn("space-y-4 text-foreground/90", className)}>
          {descriptionBlocks.map((block, index) =>
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

  if (descriptionBlocks.length > 0) {
    return (
      <div className={cn("space-y-4 text-foreground/90", className)}>
        {descriptionBlocks.map((block, index) =>
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

  return (
    <div
      className={cn(
        "prose prose-base max-w-none text-foreground/90",
        "prose-headings:text-foreground prose-headings:font-semibold",
        "prose-p:mb-5 prose-p:leading-8 prose-p:text-foreground/85",
        "prose-p:first-of-type:text-[1.02rem] prose-p:first-of-type:font-medium prose-p:first-of-type:leading-8",
        "prose-ul:my-4 prose-ul:space-y-4 prose-ul:pl-5 prose-ul:text-foreground/85",
        "prose-li:mb-1 prose-li:marker:text-primary prose-li:leading-8",
        "prose-strong:text-foreground prose-strong:font-semibold",
        "prose-a:text-primary prose-a:underline-offset-4 hover:prose-a:underline",
        "prose-blockquote:border-l-4 prose-blockquote:border-primary/25 prose-blockquote:bg-primary/5 prose-blockquote:px-4 prose-blockquote:py-3 prose-blockquote:not-italic",
        "prose-hr:border-border/70",
        "prose-p:first-child:mt-0",
        "[&_u]:underline [&_s]:line-through",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
