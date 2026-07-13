import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

type StarRatingProps = {
  rating: number;
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
  onChange?: (rating: number) => void;
};

const sizeClasses = { sm: "h-3 w-3", md: "h-4 w-4", lg: "h-5 w-5" };

export function StarRating({ rating, size = "md", interactive, onChange }: StarRatingProps) {
  const stars = [1, 2, 3, 4, 5];

  return (
    <div className="flex items-center gap-0.5" role={interactive ? "radiogroup" : "img"} aria-label={`${rating} de 5 estrelas`}>
      {stars.map((star) => (
        <button
          key={star}
          type="button"
          disabled={!interactive}
          onClick={() => interactive && onChange?.(star)}
          className={cn(
            "transition-colors",
            interactive ? "cursor-pointer hover:scale-110" : "cursor-default",
            star <= rating ? "text-amber-400" : "text-muted-foreground/25",
          )}
          role={interactive ? "radio" : undefined}
          aria-checked={interactive ? star <= rating : undefined}
          aria-label={interactive ? `${star} estrela${star > 1 ? "s" : ""}` : undefined}
        >
          <Star className={cn(sizeClasses[size], "fill-current")} />
        </button>
      ))}
    </div>
  );
}
