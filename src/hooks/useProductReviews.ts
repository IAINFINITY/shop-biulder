import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ProductReview = {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  tags: string[];
  admin_response: string | null;
  admin_responded_at: string | null;
  created_at: string;
  updated_at: string;
  user_name: string;
};

export type ProductReviewInput = {
  rating: number;
  title?: string;
  comment?: string;
  tags?: string[];
};

export type ProductReviewTag =
  | "Chegou rápido"
  | "Bem embalado"
  | "Produto de qualidade"
  | "Ótimo custo-benefício"
  | "Entrega no prazo"
  | "Funciona como esperado"
  | "Atendimento excelente"
  | "Recomendo";

export const REVIEW_TAGS: ProductReviewTag[] = [
  "Chegou rápido",
  "Bem embalado",
  "Produto de qualidade",
  "Ótimo custo-benefício",
  "Entrega no prazo",
  "Funciona como esperado",
  "Atendimento excelente",
  "Recomendo",
];

const PAGE_SIZE = 5;

export function useProductReviews(productId: string | undefined, page: number = 1) {
  const queryClient = useQueryClient();

  const queryKey = ["product-reviews", productId, page] as const;

  const query = useQuery({
    queryKey,
    enabled: !!productId,
    queryFn: async () => {
      const [reviewsResult, countResult] = await Promise.all([
        supabase.rpc("get_product_reviews", {
          p_product_id: productId!,
          p_page: page,
          p_page_size: PAGE_SIZE,
        }),
        supabase.rpc("count_product_reviews", { p_product_id: productId! }),
      ]);

      if (reviewsResult.error) throw reviewsResult.error;
      if (countResult.error) throw countResult.error;

      const totalCount = countResult.data ?? 0;

      return {
        reviews: (reviewsResult.data ?? []) as ProductReview[],
        totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / PAGE_SIZE)),
      };
    },
    initialData: { reviews: [] as ProductReview[], totalCount: 0, totalPages: 1 },
  });

  const addReview = useCallback(
    async (input: ProductReviewInput, userId: string) => {
      if (!productId) return;
      const { error } = await supabase.from("product_reviews").insert({
        product_id: productId,
        user_id: userId,
        rating: input.rating,
        title: input.title ?? null,
        comment: input.comment ?? null,
        tags: input.tags ?? [],
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["product-reviews", productId] });
    },
    [productId, queryClient],
  );

  const updateReview = useCallback(
    async (reviewId: string, input: ProductReviewInput) => {
      const { error } = await supabase
        .from("product_reviews")
        .update({
          rating: input.rating,
          title: input.title ?? null,
          comment: input.comment ?? null,
          tags: input.tags ?? [],
          updated_at: new Date().toISOString(),
        })
        .eq("id", reviewId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["product-reviews", productId] });
    },
    [productId, queryClient],
  );

  const deleteReview = useCallback(
    async (reviewId: string) => {
      const { error } = await supabase.from("product_reviews").delete().eq("id", reviewId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["product-reviews", productId] });
    },
    [productId, queryClient],
  );

  const setPage = useCallback(
    (newPage: number) => {
      queryClient.invalidateQueries({ queryKey: ["product-reviews", productId, page] });
    },
    [productId, page, queryClient],
  );

  return { ...query, addReview, updateReview, deleteReview, setPage, pageSize: PAGE_SIZE };
}
