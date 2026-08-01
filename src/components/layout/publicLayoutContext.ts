import { createContext, useContext } from "react";
import type { StoreHeaderSearchSuggestion } from "@/components/catalogo/StoreHeader";
import type { CategoryTopNavProps } from "@/components/catalogo/CategoryTopNav";

/**
 * Contexto do layout publico, separado do componente de proposito.
 *
 * Enquanto `PublicLayout.tsx` exportava o componente e tambem o contexto e o
 * hook, o Fast Refresh do React nao conseguia atualizar o modulo com seguranca
 * — o arquivo deixa de ser "so componentes" e o refresh recarrega o modulo
 * inteiro. Na pratica isso gerava duas instancias do contexto durante o
 * desenvolvimento: o Provider usava uma, quem consumia lia a outra, e a pagina
 * quebrava com "usePublicLayout must be used within PublicLayout" mesmo estando
 * dentro dele.
 */
export type PublicLayoutContextValue = {
  search: string;
  setSearch: (value: string) => void;
  searchSuggestions: StoreHeaderSearchSuggestion[];
  setSearchSuggestions: (suggestions: StoreHeaderSearchSuggestion[]) => void;
  searchHistory: string[];
  addToSearchHistory: (term: string) => void;
  removeFromSearchHistory: (term: string) => void;
  clearSearchHistory: () => void;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  categoryTopNavProps: CategoryTopNavProps | null;
  setCategoryTopNavProps: (props: CategoryTopNavProps | null) => void;
};

export const PublicLayoutContext = createContext<PublicLayoutContextValue | null>(null);

export function usePublicLayout() {
  const ctx = useContext(PublicLayoutContext);
  if (!ctx) throw new Error("usePublicLayout must be used within PublicLayout");
  return ctx;
}
