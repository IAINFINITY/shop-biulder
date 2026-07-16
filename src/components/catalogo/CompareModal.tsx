import { GitCompare, ImageIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Product } from "@/lib/products";
import { getProductImageUrls } from "@/lib/products";
import { formatBRL } from "@/lib/formatMoney";

type CompareModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
};

export function CompareModal({ open, onOpenChange, products }: CompareModalProps) {
  if (products.length < 2) return null;

  const rows = [
    { label: "Tipo", render: (p: Product) => p.type },
    { label: "Família", render: (p: Product) => p.family },
    { label: "Preço", render: (p: Product) => (p.price != null ? formatBRL(p.price) : "—") },
    { label: "Avaliação", render: (p: Product) => (p.average_rating > 0 ? `${p.average_rating.toFixed(1)} (${p.review_count})` : "—") },
    { label: "Estoque", render: (p: Product) => p.stock != null ? `${p.stock} un.` : "—" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(90vw,56rem)] rounded-[1.5rem] border-border/70 p-0">
        <DialogHeader className="flex flex-row items-center justify-between px-5 py-4 sm:px-6 sm:py-5">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <GitCompare className="h-5 w-5 text-primary" />
            Comparar produtos
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40">
                <th className="sticky left-0 z-10 bg-muted/40 px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground sm:px-6" />
                {products.map((p) => {
                  const imgUrl = getProductImageUrls(p)[0];
                  return (
                    <th key={p.id} className="px-4 py-3 text-center sm:px-5">
                      <div className="flex flex-col items-center gap-2">
                        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-border bg-background sm:h-20 sm:w-20">
                          {imgUrl ? (
                            <img src={imgUrl} alt={p.name} className="h-full w-full object-contain p-1.5" />
                          ) : (
                            <ImageIcon className="h-5 w-5 text-muted-foreground/30" />
                          )}
                        </div>
                        <p className="text-[12px] font-medium leading-tight text-foreground line-clamp-2">{p.name}</p>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-b border-border/30">
                  <td className="sticky left-0 z-10 bg-card px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:px-6">
                    {row.label}
                  </td>
                  {products.map((p) => (
                    <td key={p.id} className="px-4 py-2.5 text-center text-[13px] text-foreground sm:px-5">
                      {row.render(p)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
