import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plus, Leaf, Pill, FlaskConical, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PRODUCTS_TABLE, Product, getCart, saveCart } from "@/lib/products";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const typeIcons: Record<string, any> = {
  "Chá": Leaf,
  "Cápsula": Pill,
  "Solúvel": FlaskConical,
};

const typeColors: Record<string, string> = {
  "Chá": "bg-success/10 text-success border-success/20",
  "Cápsula": "bg-warm/10 text-warm border-warm/20",
  "Solúvel": "bg-primary/10 text-primary border-primary/20",
};

export default function ProductDetails() {
  const { id } = useParams();

  const { data: product, isLoading, error } = useQuery({
    queryKey: ["product", id],
    enabled: !!id,
    queryFn: async () => {
      if (!id) throw new Error("Produto não informado");
      const { data, error } = await supabase
        .from(PRODUCTS_TABLE)
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as Product;
    },
  });

  const handleAdd = () => {
    if (!product) return;
    const cart = getCart();
    if (cart.some((c) => c.product.id === product.id)) {
      toast.info("Produto já está no carrinho");
      return;
    }
    saveCart([...cart, { product, quantity: 1 }]);
    toast.success(`${product.name} adicionado!`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Carregando produto...
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Produto não encontrado.</p>
          <Link to="/">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Voltar ao catálogo
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const Icon = typeIcons[product.type] || Leaf;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 h-14 flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <span className="font-semibold text-foreground">Detalhes do Produto</span>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {product.image_url ? (
              <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <div className="aspect-[4/3] bg-muted flex items-center justify-center">
                <ImageIcon className="w-16 h-16 text-muted-foreground/30" />
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className={`${typeColors[product.type] || ""} text-xs font-medium`}>
                <Icon className="w-3 h-3 mr-1" />
                {product.type}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {product.family}
              </Badge>
            </div>

            <h1 className="text-2xl font-bold text-foreground">{product.name}</h1>

            <p className="text-muted-foreground leading-relaxed">
              {product.description}
            </p>

            <div className="pt-2">
              <Button onClick={handleAdd} className="gap-2">
                <Plus className="w-4 h-4" /> Adicionar ao carrinho
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
