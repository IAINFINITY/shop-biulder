import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type CatalogNotificationImageFrameProps = {
  src?: string | null;
  alt: string;
  className?: string;
  iconClassName?: string;
  fit?: "contain" | "cover";
  showBackdrop?: boolean;
};

export function CatalogNotificationImageFrame({
  src,
  alt,
  className,
  iconClassName,
  fit = "contain",
  showBackdrop = true,
}: CatalogNotificationImageFrameProps) {
  const imageSrc = src?.trim();

  return (
    <div className={cn("relative overflow-hidden bg-muted/20", className)}>
      {imageSrc ? (
        <>
          {showBackdrop ? (
            <>
              <img
                src={imageSrc}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-xl"
              />
              <div className="absolute inset-0 bg-background/10" aria-hidden="true" />
            </>
          ) : null}
          <img
            src={imageSrc}
            alt={alt}
            className={cn("relative z-10 h-full w-full", fit === "cover" ? "object-cover" : "object-contain")}
          />
        </>
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 via-background to-muted/20">
          <ImageIcon className={cn("h-10 w-10 text-muted-foreground/30", iconClassName)} />
        </div>
      )}
    </div>
  );
}
