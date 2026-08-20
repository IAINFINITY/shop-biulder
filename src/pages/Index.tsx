import { useState, useMemo, useCallback, useEffect, useLayoutEffect, useRef, memo } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { CatalogProductCard } from "@/components/catalogo/CatalogProductCard";
import { StoreHeroBanner } from "@/components/catalogo/StoreHeroBanner";
import { CatalogThemeSections, type CatalogThemeSection } from "@/components/catalogo/CatalogThemeSections";
import { CatalogSectionHeader } from "@/components/catalogo/CatalogSectionHeader";
import { PromoDuo, PromoTrio, PromoUnico } from "@/components/catalogo/PromoBanners";
import { CatalogFilterPanel, type CatalogFilterOption } from "@/components/catalogo/CatalogFilterPanel";
import { useCategoriasOcultas } from "@/hooks/useCategoriasOcultas";
import { semCategoriasOcultas } from "@/lib/categoriasOcultas";
import { CatalogActiveFilters, type CatalogActiveFilter } from "@/components/catalogo/CatalogActiveFilters";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { QuickView } from "@/components/catalogo/QuickView";
import { cn } from "@/lib/utils";
import { PAGE_CONTAINER_VITRINE } from "@/lib/pageLayout";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { descriptionIncludesQuery } from "@/lib/richTextPure";
import { useProducts } from "@/hooks/useProducts";
import { useOrders } from "@/hooks/useOrders";
import { useCart } from "@/hooks/useCart";
import { useCustomerPricing } from "@/hooks/useCustomerPricing";
import { EMPTY_PRICE_MAP, resolveProductPrice, resolvePrecoBase } from "@/lib/pricing";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUpDown, ChevronUp, Flame,
  Sparkles, History, LayoutGrid, SlidersHorizontal, Tag } from "lucide-react";
import { useRecentlyViewed } from "@/hooks/useRecentlyViewed";
import { useWishlist } from "@/hooks/useWishlist";
import { useDebounce } from "@/hooks/useDebounce";
import { usePublicLayout } from "@/components/layout/publicLayoutContext";
import { useAuth } from "@/hooks/useAuth";
import { useCustomerTypes } from "@/hooks/useCustomerTypes";
import { useTopSellers } from "@/hooks/useTopSellers";
import { completarFileira, useGridColumns } from "@/hooks/useGridColumns";
import { podeVer } from "@/lib/visibilidade";
import { useFiltroBooleanoNaUrl, useFiltroComPadraoNaUrl, useFiltroNaUrl } from "@/hooks/useFiltroNaUrl";
import { estaEmPromocao as emPromocao } from "@/lib/promocao";
import { produtoTemSubcategoria, subcategoriasDoProduto } from "@/lib/subcategorias";
import { ConfirmActionDialog } from "@/components/shared/ConfirmActionDialog";
import { resolveProductsByIdOrder } from "@/lib/productIdList";
import { SectionAnchorNav, type SectionAnchor } from "@/components/shared/SectionAnchorNav";
import type { Product } from "@/lib/products";

const INITIAL_PRODUCTS_VISIBLE = 24;

const ANCORA_ICONES: Record<string, typeof Flame> = {
  promocoes: Tag,
  "em-destaque": Sparkles,
  "mais-vendidos": Flame,
};
const PRODUCTS_VISIBLE_STEP = 24;
const CATALOG_VIEW_STORAGE_KEY = "clinicplus_catalog_view";

type CatalogViewState = {
  search: string;
  selectedType: string | null;
  selectedFamily: string | null;
  selectedBrand: string | null;
  onlyPromotions: boolean;
  visibleProducts: number;
  scrollY: number;
  sortMode: CatalogSortMode;
};

function readCatalogViewState(): CatalogViewState | null {
  try {
    const raw = typeof window === "undefined" ? null : window.sessionStorage.getItem(CATALOG_VIEW_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CatalogViewState>;
    return {
      search: typeof parsed.search === "string" ? parsed.search : "",
      selectedType: typeof parsed.selectedType === "string" ? parsed.selectedType : null,
      selectedFamily: typeof parsed.selectedFamily === "string" ? parsed.selectedFamily : null,
      selectedBrand: typeof parsed.selectedBrand === "string" ? parsed.selectedBrand : null,
      onlyPromotions: parsed.onlyPromotions === true,
      visibleProducts: INITIAL_PRODUCTS_VISIBLE,
      scrollY:
        typeof parsed.scrollY === "number" && Number.isFinite(parsed.scrollY) ? Math.max(0, parsed.scrollY) : 0,
      sortMode:
        parsed.sortMode === "best_sellers" ||
        parsed.sortMode === "price_asc" ||
        parsed.sortMode === "price_desc" ||
        parsed.sortMode === "name_asc"
          ? parsed.sortMode
          : "relevance",
    };
  } catch {
    return null;
  }
}

function saveCatalogViewState(state: CatalogViewState) {
  try {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(CATALOG_VIEW_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Keep the catalog usable even when session storage is unavailable.
  }
}

export type CatalogSortMode = "relevance" | "best_sellers" | "price_asc" | "price_desc" | "name_asc";

/** Guarda o valor que vem da URL: `?ordem=qualquer-coisa` nao pode quebrar a tela. */
const ehModoDeOrdenacao = (valor: string): valor is CatalogSortMode =>
  Object.prototype.hasOwnProperty.call(SORT_LABELS, valor);

const SORT_LABELS: Record<CatalogSortMode, string> = {
  relevance: "Relevância",
  best_sellers: "Mais vendidos",
  price_asc: "Menor preço",
  price_desc: "Maior preço",
  name_asc: "Nome A-Z",
};

const SortModeControl = memo(function SortModeControl({
  value,
  onChange,
}: {
  value: CatalogSortMode;
  onChange: (mode: CatalogSortMode) => void;
}) {
  const handleChange = useCallback((v: string) => onChange(v as CatalogSortMode), [onChange]);
  return (
    <Select value={value} onValueChange={handleChange}>
      <SelectTrigger className="h-10 sm:h-8 w-full gap-1.5 rounded-full border-border/60 bg-background px-3 text-xs font-medium shadow-none hover:bg-muted/40 sm:w-auto [&>svg]:h-3.5 [&>svg]:w-3.5">
        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end" className="rounded-xl border-border/60">
        {(Object.entries(SORT_LABELS) as [CatalogSortMode, string][]).map(([mode, label]) => (
          <SelectItem key={mode} value={mode} className="rounded-lg text-sm">
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
});

export default function Index() {
  const location = useLocation();
  const { data: products = [], isLoading } = useProducts();
  // Com o auth ligado na home, o perfil vem da sessao real. O provider ja
  // inicializa a partir do mesmo cache que era lido aqui, entao a primeira
  // pintura continua imediata — mas agora ele tambem revalida.
  const { customerProfile, isAdmin } = useAuth();
  const { options: tiposDeCliente } = useCustomerTypes();
  const todosOsTipos = useMemo(() => tiposDeCliente.map((tipo) => tipo.name), [tiposDeCliente]);
  const { data: orderHistory = [] } = useOrders(Boolean(customerProfile), "catalog");
  const customerType = customerProfile?.customer_type ?? null;
  const customerTprId = customerProfile?.proxis_tpr_id ?? null;
  const { data: customerPriceMap = EMPTY_PRICE_MAP } = useCustomerPricing(
    customerType,
    customerTprId,
  );
  const { cart, addToCart, updateQuantity, setQuantity, removeFromCart, clearCart } = useCart();
  const { ids: recentlyViewedIds } = useRecentlyViewed();
  const { ids: wishlistIds, toggle: toggleWishlist } = useWishlist();
  const { search, setSearch, setIsCartOpen } = usePublicLayout();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const debouncedSearch = useDebounce(search, 250);
  const [quickViewProduct, setQuickViewProduct] = useState<string | null>(null);
  /**
   * Os filtros vivem **so** na URL.
   *
   * Antes ficavam em `useState` com copia no `localStorage`, e a URL nunca mudava
   * — nao dava para compartilhar link nem apontar banner para uma categoria.
   * A primeira tentativa de corrigir espelhou as duas fontes com efeitos e virou
   * laco: 58 trocas de endereco ao clicar num banner.
   *
   * Derivando da URL nao ha segunda fonte, entao nao ha o que sincronizar. O
   * "voltar" do navegador tambem restaura o filtro sozinho, que era o motivo de
   * o `localStorage` guardar isso.
   */
  const categoriasOcultas = useCategoriasOcultas();
  const [selectedType, setSelectedType] = useFiltroNaUrl("categoria");
  const [selectedFamily, setSelectedFamily] = useFiltroNaUrl("subcategoria");
  const [selectedBrand, setSelectedBrand] = useFiltroNaUrl("marca");
  const [onlyPromotions, setOnlyPromotions] = useFiltroBooleanoNaUrl("promocao");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortMode, setSortMode] = useFiltroComPadraoNaUrl<CatalogSortMode>(
    "ordem",
    "relevance",
    ehModoDeOrdenacao,
  );
  const [visibleProducts, setVisibleProducts] = useState(
    () => readCatalogViewState()?.visibleProducts ?? INITIAL_PRODUCTS_VISIBLE,
  );
  const catalogRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const restoredScrollRef = useRef(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  // `?view=favoritos` virou a rota `/favoritos`.
  //
  // Era query param na home: nao dava para fixar, sumia do historico e obrigava
  // Conta e Ajuda a montarem o link na mao. O redirect mantem vivo o link que
  // alguem ja tenha salvo.
  useEffect(() => {
    if (searchParams.get("view") === "favoritos") {
      navigate("/favoritos", { replace: true });
    }
  }, [navigate, searchParams]);
  const handleRequestAdd = useCallback((product: Product) => {
    setQuickViewProduct(product.id);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleScroll = () => setShowBackToTop(window.scrollY > 400);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useLayoutEffect(() => {
    if (typeof window === "undefined" || restoredScrollRef.current) return;

    restoredScrollRef.current = true;
    const savedState = readCatalogViewState();
    window.history.scrollRestoration = "manual";
    const shouldScrollTop = Boolean((location.state as { scrollToTop?: boolean } | null | undefined)?.scrollToTop);
    window.scrollTo({ top: shouldScrollTop ? 0 : savedState?.scrollY ?? 0, left: 0, behavior: "auto" });

    return () => {
      window.history.scrollRestoration = "auto";
    };
  }, [location.state]);

  useEffect(() => {
    setVisibleProducts(INITIAL_PRODUCTS_VISIBLE);
  }, [search, selectedType, selectedFamily, selectedBrand, onlyPromotions, sortMode]);

  /**
   * Leva a visao para o topo dos resultados quando um filtro muda.
   *
   * O reset da lista para 24 itens encolhe a pagina, e o navegador respondia
   * jogando a rolagem para cima sozinho — parecia um salto sem motivo. Rolar de
   * proposito para o inicio dos resultados e o comportamento esperado ao filtrar,
   * e fica suave. Fora da lista de dependencias: `search`, que dispararia a cada
   * tecla digitada.
   */
  const skipFilterScrollRef = useRef(true);
  useEffect(() => {
    if (skipFilterScrollRef.current) {
      skipFilterScrollRef.current = false;
      return;
    }
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedType, selectedFamily, selectedBrand, onlyPromotions, sortMode]);

  useEffect(() => {
    return () => {
      saveCatalogViewState({
        search,
        selectedType,
        selectedFamily,
        selectedBrand,
        onlyPromotions,
        visibleProducts,
        scrollY: typeof window === "undefined" ? 0 : window.scrollY,
        sortMode,
      });
    };
  }, [search, selectedType, selectedFamily, selectedBrand, onlyPromotions, visibleProducts, sortMode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        const selector = window.matchMedia("(min-width: 1024px)").matches
          ? 'input[data-catalog-search="desktop"]'
          : 'input[data-catalog-search="mobile"]';
        (document.querySelector(selector) as HTMLInputElement | null)?.focus();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const familyCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const product of products) {
      // Um produto em duas subcategorias conta nas duas — e a leitura certa:
      // o numero ao lado do filtro diz quantos aparecem ao clicar nele.
      for (const sub of subcategoriasDoProduto(product)) {
        counts.set(sub, (counts.get(sub) ?? 0) + 1);
      }
    }
    return counts;
  }, [products]);

  /**
   * A regra de filtro, num lugar so, com um recorte opcional de fora.
   *
   * `ignorar` existe para as contagens do painel. Cada grupo de opcoes precisa
   * ser contado com **todos os filtros ativos menos o proprio**: a lista de
   * Subcategoria leva em conta a Categoria escolhida, mas nao a subcategoria
   * escolhida — senao ela ficaria com uma opcao so, a que ja esta marcada.
   *
   * Escrever isso como um segundo `filter` copiado seria repetir a regra, e este
   * projeto ja pagou esse preco: a versao anterior desta funcao tinha a condicao
   * de visibilidade reescrita a mao, sem "marcou tudo" e sem a excecao do admin,
   * e por isso a grade escondia o que a prateleira mostrava.
   */
  const casaComFiltros = useCallback(
    (p: Product, ignorar?: "type" | "family" | "brand" | "promo") => {
      const query = debouncedSearch;
      if (
        query &&
        !p.name.toLowerCase().includes(query.toLowerCase()) &&
        !descriptionIncludesQuery(p.description, query)
      ) {
        return false;
      }
      if (ignorar !== "type" && selectedType && p.type !== selectedType) return false;
      if (ignorar !== "family" && selectedFamily && !produtoTemSubcategoria(p, selectedFamily)) return false;
      if (ignorar !== "brand" && selectedBrand && (p.brand ?? "") !== selectedBrand) return false;
      if (ignorar !== "promo" && onlyPromotions && !emPromocao(p)) return false;
      return podeVer(p, { customerType, todosOsTipos, isAdmin });
    },
    [debouncedSearch, selectedType, selectedFamily, selectedBrand, onlyPromotions, customerType, todosOsTipos, isAdmin],
  );

  const filtered = useMemo(
    () => products.filter((p) => casaComFiltros(p)),
    [products, casaComFiltros],
  );

  /**
   * Produtos que o cliente pode ver, antes de qualquer filtro.
   *
   * As contagens de cada opcao saem daqui, e nao de `filtered`: se saissem do
   * resultado ja filtrado, escolher "Chá" zeraria a contagem de todas as outras
   * categorias e o painel pareceria vazio.
   */
  const visibleCatalog = useMemo(
    () => products.filter((product) => podeVer(product, { customerType, todosOsTipos, isAdmin })),
    [products, customerType, isAdmin, todosOsTipos],
  );

  const countBy = useCallback((getKey: (product: Product) => string) => {
    return (source: Product[]): CatalogFilterOption[] => {
      const counts = new Map<string, number>();
      for (const product of source) {
        const key = getKey(product).trim();
        if (!key) continue;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      return [...counts.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value, "pt-BR"));
    };
  }, []);

  /**
   * Mantem na lista a opcao que esta marcada, mesmo sem produto.
   *
   * Combinacao impossivel acontece: escolher a categoria "Chá" e depois uma
   * subcategoria que so existe em suplemento. Se a opcao marcada sumisse do
   * painel, a pessoa veria a grade vazia sem enxergar o que desmarcar — o
   * filtro continuaria valendo, invisivel. Ela fica, com zero.
   */
  const comSelecionada = useCallback(
    (opcoes: CatalogFilterOption[], selecionada: string | null): CatalogFilterOption[] =>
      !selecionada || opcoes.some((o) => o.value === selecionada)
        ? opcoes
        : [...opcoes, { value: selecionada, count: 0 }],
    [],
  );

  /**
   * As opcoes de cada grupo saem do catalogo cruzado com os **outros** filtros.
   *
   * Antes saiam de `visibleCatalog` — o catalogo inteiro, sem filtro nenhum.
   * O efeito era o relatado: escolher uma categoria e continuar vendo todas as
   * subcategorias do site, a maioria sem um unico produto naquela categoria.
   * Clicar numa delas levava a uma grade vazia.
   *
   * Cada grupo ignora o proprio filtro (o `ignorar`), e nao os demais. E o que
   * mantem a promessa da contagem: o numero ao lado da opcao e quantos produtos
   * aparecem se voce clicar nela **agora**, com o que ja esta marcado.
   */
  const brandOptions = useMemo(
    () =>
      comSelecionada(
        countBy((product) => product.brand ?? "")(products.filter((p) => casaComFiltros(p, "brand"))),
        selectedBrand,
      ),
    [countBy, products, casaComFiltros, comSelecionada, selectedBrand],
  );
  /**
   * A lista de Categoria, menos o que o painel escondeu.
   *
   * O filtro entra **depois** de `comSelecionada`: uma categoria oculta que
   * esteja marcada no momento continua na lista, senao o filtro ficaria ativo e
   * invisivel — a grade mostraria pouca coisa e nao haveria o que desmarcar.
   * Isso tambem mantem de pe os links diretos (`?categoria=Whey`), inclusive os
   * de banner.
   */
  const typeOptions = useMemo(
    () => {
      const todas = countBy((product) => product.type)(products.filter((p) => casaComFiltros(p, "type")));
      const visiveis = semCategoriasOcultas(todas, categoriasOcultas, (o) => o.value);
      return comSelecionada(visiveis, selectedType);
    },
    [countBy, products, casaComFiltros, comSelecionada, selectedType, categoriasOcultas],
  );
  const familyOptions = useMemo(
    () => {
      // Mesma forma que o `countBy` devolve, mas contando **cada** subcategoria
      // do produto — ele conta uma chave por produto e aqui um produto pode
      // entrar em varias.
      const contagem = new Map<string, number>();
      for (const product of products) {
        if (!casaComFiltros(product, "family")) continue;
        for (const sub of subcategoriasDoProduto(product)) {
          contagem.set(sub, (contagem.get(sub) ?? 0) + 1);
        }
      }
      const lista = [...contagem.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value, "pt-BR"));
      return comSelecionada(lista, selectedFamily);
    },
    [products, casaComFiltros, comSelecionada, selectedFamily],
  );
  // Pelo mesmo motivo dos grupos acima: com uma categoria escolhida, "Promoção
  // (57)" prometendo 57 e entregando 3 e a mesma quebra de contrato.
  const promotionCount = useMemo(
    () => products.filter((p) => casaComFiltros(p, "promo") && emPromocao(p)).length,
    [products, casaComFiltros],
  );

  const activeFilters = useMemo<CatalogActiveFilter[]>(() => {
    const list: CatalogActiveFilter[] = [];
    if (onlyPromotions) {
      list.push({ id: "promo", label: "Destaque", value: "Promoção", onRemove: () => setOnlyPromotions(false) });
    }
    if (selectedBrand) {
      list.push({ id: "brand", label: "Marca", value: selectedBrand, onRemove: () => setSelectedBrand(null) });
    }
    if (selectedType) {
      list.push({ id: "type", label: "Categoria", value: selectedType, onRemove: () => setSelectedType(null) });
    }
    if (selectedFamily) {
      list.push({
        id: "family",
        label: "Subcategoria",
        value: selectedFamily,
        onRemove: () => setSelectedFamily(null),
      });
    }
    return list;
  }, [onlyPromotions, selectedBrand, selectedType, selectedFamily,
      setOnlyPromotions, setSelectedBrand, setSelectedFamily, setSelectedType]);

  // Os setters vem do `useFiltroNaUrl` e sao estaveis (dependem so da chave e do
  // `setSearchParams` do router), mas o eslint nao tem como saber — entao entram
  // na lista em vez de a regra ser silenciada.
  const clearAllFilters = useCallback(() => {
    setSelectedBrand(null);
    setSelectedType(null);
    setSelectedFamily(null);
    setOnlyPromotions(false);
  }, [setSelectedBrand, setSelectedType, setSelectedFamily, setOnlyPromotions]);

  /**
   * Duas nocoes de "vende bem", de proposito.
   *
   * `posicaoDeVenda` e a loja inteira, agregada no banco — e o que a prateleira
   * "Mais vendidos" e o selo usam, porque e uma afirmacao sobre a loja.
   *
   * `orderPopularity` sao os pedidos de **quem esta olhando** (o RLS so entrega
   * os proprios). Serve a ordenacao por relevancia, onde o que a pessoa costuma
   * comprar e justamente o mais relevante para ela.
   */
  const { posicaoDeVenda } = useTopSellers();

  const orderPopularity = useMemo(() => {
    const quantityCounts = new Map<string, number>();

    for (const order of orderHistory) {
      for (const item of order.items) {
        const productId = typeof item.product_id === "string" ? item.product_id.trim() : "";
        if (!productId) continue;

        quantityCounts.set(productId, (quantityCounts.get(productId) ?? 0) + Math.max(1, item.quantity));
      }
    }

    return { quantityCounts };
  }, [orderHistory]);

  const sortedFiltered = useMemo(() => {
    const list = [...filtered];

    switch (sortMode) {
      case "best_sellers":
        return list.sort((left, right) => {
          // `?? Infinity` joga para o fim quem nunca foi vendido, em vez de
          // empatar em zero com todo o resto.
          const leftQty = posicaoDeVenda.get(left.id) ?? Infinity;
          const rightQty = posicaoDeVenda.get(right.id) ?? Infinity;
          const leftPromo = left.is_promotion ? 1 : 0;
          const rightPromo = right.is_promotion ? 1 : 0;
          return rightQty - leftQty || rightPromo - leftPromo || left.name.localeCompare(right.name, "pt-BR");
        });
      case "price_asc":
        return list.sort(
          (left, right) =>
            resolveProductPrice(left, customerPriceMap) - resolveProductPrice(right, customerPriceMap) ||
            left.name.localeCompare(right.name, "pt-BR"),
        );
      case "price_desc":
        return list.sort(
          (left, right) =>
            resolveProductPrice(right, customerPriceMap) - resolveProductPrice(left, customerPriceMap) ||
            left.name.localeCompare(right.name, "pt-BR"),
        );
      case "name_asc":
        return list.sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
      case "relevance":
      default:
        return list.sort((left, right) => {
          const leftPromo = left.is_promotion ? 1 : 0;
          const rightPromo = right.is_promotion ? 1 : 0;
          // Historico da propria pessoa: em relevancia, o que ela ja comprou vale
          // mais que o que a loja vende no agregado.
          const leftQty = orderPopularity.quantityCounts.get(left.id) ?? 0;
          const rightQty = orderPopularity.quantityCounts.get(right.id) ?? 0;

          return rightPromo - leftPromo || rightQty - leftQty || left.name.localeCompare(right.name, "pt-BR");
        });
    }
  }, [filtered, sortMode, orderPopularity, posicaoDeVenda, customerPriceMap]);

  /**
   * Corta a lista num multiplo de colunas.
   *
   * `visibleProducts` e quantos o usuario pediu; o que aparece e isso arredondado
   * para cima ate fechar a fileira. Sem esse arredondamento, o passo de 24 —
   * divisivel por 2, 3 e 4 — deixava sobra em 5 colunas, e cada "carregar mais"
   * terminava com uma fileira pela metade ainda havendo produto de sobra.
   *
   * No fim da lista o total vale como esta: sobra na ultima fileira so confunde
   * quando ainda ha o que carregar.
   */
  const gridRef = useRef<HTMLDivElement>(null);
  const gridColumns = useGridColumns(gridRef);

  const visibleFiltered = useMemo(
    () => sortedFiltered.slice(0, completarFileira(visibleProducts, gridColumns, sortedFiltered.length)),
    [sortedFiltered, visibleProducts, gridColumns],
  );
  // Compara o que **esta na tela**, e nao o numero pedido: o arredondamento por
  // fileira mostra alguns a mais, e com a comparacao antiga o botao continuaria
  // aparecendo depois que o ultimo produto ja tivesse entrado.
  const hasMoreProducts = visibleFiltered.length < sortedFiltered.length;

  const showMoreProducts = useCallback(() => {
    // Parte do que ja esta visivel, pelo mesmo motivo: somar sobre o numero
    // pedido faria o proximo lote vir menor do que o passo.
    setVisibleProducts(() => Math.min(visibleFiltered.length + PRODUCTS_VISIBLE_STEP, sortedFiltered.length));
  }, [visibleFiltered.length, sortedFiltered.length]);

  /**
   * O carregamento e por botao, de proposito.
   *
   * Cheguei a deixar o proximo lote entrar sozinho na rolagem, mas rolagem
   * infinita e justamente o padrao que os testes de usabilidade reprovam em
   * lista de produto: quem abre um item e volta perde a posicao, comparar fica
   * dificil e o rodape vira inalcancavel. "Carregar mais" explicito e o padrao
   * recomendado — o usuario decide quando continuar.
   */

  const cartIds = useMemo(() => new Set(cart.map((c) => c.product.id)), [cart]);

  const showAllProducts = useCallback(() => {
    setSearch("");
    setSelectedType(null);
    setSelectedFamily(null);
    setVisibleProducts(INITIAL_PRODUCTS_VISIBLE);
    catalogRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // Percorre os ids, e nao o catalogo: filtrar `products` devolvia a lista em
  // ordem alfabetica (o banco ordena por nome), o que anulava o sentido de
  // "vistos recentemente" e a ordem de favoritagem.
  const recentlyViewedProducts = useMemo(
    () => resolveProductsByIdOrder(recentlyViewedIds, products, 10),
    [products, recentlyViewedIds],
  );


  /**
   * Prateleiras do topo: apenas curadoria.
   *
   * Antes havia tambem uma prateleira por categoria (Chá, Solúvel, Cápsula).
   * Com os filtros na lateral elas viraram repeticao — a sidebar mostra as
   * categorias inteiras, enquanto a prateleira mostrava 8 itens escolhidos por
   * nada em especial. E cinco carrosseis empurravam o catalogo uns 2.500px para
   * baixo.
   *
   * Sobram os dois recortes que respondem "o que vale a pena olhar?", coisa que
   * filtro nenhum responde: preco reduzido e o que mais sai.
   */
  const catalogThemeSections = useMemo(() => {
    // Com filtro ativo o cliente ja disse o que quer: curadoria vira ruido entre
    // ele e o resultado.
    if (activeFilters.length > 0 || debouncedSearch.trim()) return [];
    if (visibleCatalog.length === 0) return [];

    const promotedProducts = visibleCatalog
      // Curadoria **e** desconto valendo. `is_promotion` sozinho enchia o
      // carrossel de produto com preco cheio; desconto sozinho nao basta porque
      // esta prateleira e uma escolha editorial, nao a lista completa.
      .filter((product) => product.is_promotion && emPromocao(product))
      .sort(
        (left, right) =>
          resolveProductPrice(left, customerPriceMap) - resolveProductPrice(right, customerPriceMap) ||
          new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime() ||
          left.name.localeCompare(right.name, "pt-BR"),
      );

    /**
     * So quem realmente vendeu, na ordem de venda.
     *
     * Antes a lista era `visibleCatalog` inteiro ordenado por um sinal fraco:
     * quem nao tinha pedido caia num desempate por tamanho da familia e depois
     * por ordem alfabetica. Como o `.slice(0, 8)` vinha logo em seguida, a
     * prateleira se enchia de produto que nunca foi vendido — parecia sorteio.
     *
     * Agora o sinal vem de `top_selling_products()`, agregado no banco sobre os
     * pedidos de **todos** os clientes. Sem venda nenhuma, a prateleira nao
     * aparece, o que e mais honesto que preenche-la com qualquer coisa.
     */
    const withPopularSignal = visibleCatalog
      .filter((product) => posicaoDeVenda.has(product.id))
      .sort((left, right) => posicaoDeVenda.get(left.id)! - posicaoDeVenda.get(right.id)!);

    const featuredProducts = visibleCatalog
      .filter((product) => product.is_featured)
      .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));

    /**
     * A ordem: destaque, mais vendidos, promocao.
     *
     * A primeira posicao e a mais vista, entao vai para a prateleira que rende
     * mais por estar la. Promocao nao rende: preco e o gancho mais forte que
     * existe, e quem caca desconto rola a pagina ate achar — colocar na frente e
     * gastar o melhor espaco com a unica que se vende sozinha. Pior, ancora a
     * loja no desconto: tudo que vem depois parece caro por comparacao.
     *
     * Destaque e a unica prateleira que a equipe controla de ponta a ponta —
     * promocao depende de ter margem para queimar, mais vendidos depende do que
     * o mercado ja decidiu. E a de maior alavancagem, e por isso abre.
     *
     * Mais vendidos vem em seguida como prova social: "a equipe destaca isto, e
     * olha o que todo mundo leva". Num B2B de recompra e a que melhor responde
     * "o que o meu segmento costuma pedir".
     */
    const sections: CatalogThemeSection[] = [];

    if (featuredProducts.length > 0) {
      sections.push({
        id: "em-destaque",
        title: "Em destaque",
        subtitle:
          featuredProducts.length === 1
            ? "1 produto escolhido pela equipe"
            : `${featuredProducts.length} produtos escolhidos pela equipe`,
        highlightLabel: "Destaque",
        // Ambar, e nao a cor da marca: o vermelho ja e da promocao e o verde dos
        // mais vendidos. Tres prateleiras seguidas precisam de tres cores.
        highlightTone: "warm",
        products: featuredProducts.slice(0, 8),
      });
    }

    if (withPopularSignal.length > 0) {
      sections.push({
        id: "mais-vendidos",
        title: "Mais vendidos",
        subtitle: "Os itens que mais saem nos pedidos",
        highlightLabel: "Mais vendido",
        highlightTone: "success",
        products: withPopularSignal.slice(0, 8),
      });
    }

    if (promotedProducts.length > 0) {
      sections.push({
        id: "promocoes",
        title: "Promoções",
        subtitle:
          promotedProducts.length === 1
            ? "1 produto com preço reduzido"
            : `${promotedProducts.length} produtos com preço reduzido`,
        highlightLabel: "Promoção",
        highlightTone: "destructive",
        products: promotedProducts.slice(0, 8),
      });
    }

    return sections;
  }, [activeFilters.length, customerPriceMap, debouncedSearch, posicaoDeVenda, visibleCatalog]);

  /**
   * Ancoras da pagina, montadas a partir do que existe de fato.
   *
   * Promocao pode nao ter produto, favoritos podem estar vazios e as
   * prateleiras somem quando ha filtro — um indice fixo levaria a secao
   * inexistente.
   */
  const pageAnchors = useMemo<SectionAnchor[]>(() => {
    const anchors: SectionAnchor[] = catalogThemeSections.map((section) => ({
      id: section.id,
      label: section.title,
      // Um icone por prateleira. Com "Em destaque" no meio, o par
      // promocao/resto deixou de dar conta: destaque e mais vendidos ficariam
      // com a mesma chama e a barra perderia a funcao de orientar.
      icon: ANCORA_ICONES[section.id] ?? Flame,
    }));

    anchors.push({ id: "catalogo-completo", label: "Catálogo", icon: LayoutGrid });

    if (recentlyViewedProducts.length > 0) {
      anchors.push({ id: "vistos-recentemente", label: "Vistos recentemente", icon: History });
    }

    return anchors;
  }, [catalogThemeSections, recentlyViewedProducts.length]);

  return (
    <div id="top" className="min-h-screen bg-muted/40">
      <StoreHeroBanner customerType={customerType} />

      <div
        ref={catalogRef}
        id="catalogo-produtos"
        className={cn(PAGE_CONTAINER_VITRINE, "pt-1 pb-32 sm:pt-3 sm:pb-[10rem]")}
      >
        <SectionAnchorNav
          sections={pageAnchors}
          className="mb-6"
        />

        <div className="space-y-10 sm:space-y-12">
            {/* 2o bloco da pagina (o 1o e o banner do topo): 3 do mesmo
                tamanho, na mesma reta.

                Fica acima das secoes tematicas, e nao colado em
                `#catalogo-completo`. Estava logo antes da grade, encostado na
                coluna de filtros — que e o caso documentado pela Baymard na
                Toys'R'Us, onde varios participantes tomaram um banner acima da
                lista por ferramenta de filtro. Aqui em cima nao ha lista nem
                filtro por perto para confundir, e a ordem 1/3/1/2/1 da pagina
                continua igual. */}
            <PromoTrio label="Catálogo · 3" customerType={customerType} />

            <CatalogThemeSections
              carregando={isLoading}
              sections={catalogThemeSections}
              resolvePrice={(product) => resolveProductPrice(product, customerPriceMap)}
              resolvePrecoBase={(product) => resolvePrecoBase(product, customerPriceMap)}
              onAdd={handleRequestAdd}
              inCartIds={cartIds}
              wishlistIds={wishlistIds}
              onToggleWishlist={toggleWishlist}
            />

            <section
              id="catalogo-completo"
              className="grid gap-6 scroll-mt-[calc(var(--page-header-shell-height,88px)+4rem)] lg:grid-cols-[15rem_minmax(0,1fr)] xl:gap-8"
            >
              {/* Coluna fixa no desktop: todos os filtros visiveis de uma vez,
                  que e o que a barra horizontal nao conseguia entregar com 48
                  subcategorias. */}
              <aside className="hidden lg:block">
                <div className="sticky top-[calc(var(--page-header-shell-height,88px)+1rem)] max-h-[calc(100dvh-var(--page-header-shell-height,88px)-2rem)] overflow-y-auto rounded-xl bg-background/80 p-4 ring-1 ring-black/5 [scrollbar-width:thin]">
                  <CatalogFilterPanel
                    brands={brandOptions}
                    types={typeOptions}
                    families={familyOptions}
                    selectedBrand={selectedBrand}
                    selectedType={selectedType}
                    selectedFamily={selectedFamily}
                    onlyPromotions={onlyPromotions}
                    promotionCount={promotionCount}
                    onBrandChange={setSelectedBrand}
                    onTypeChange={setSelectedType}
                    onFamilyChange={setSelectedFamily}
                    onOnlyPromotionsChange={setOnlyPromotions}
                    onClearAll={clearAllFilters}
                    activeFilterCount={activeFilters.length}
                  />
                </div>
              </aside>

              <div
                ref={resultsRef}
                className="min-w-0 space-y-4 scroll-mt-[calc(var(--page-header-shell-height,88px)+1rem)]"
              >
              <CatalogSectionHeader
                title={selectedFamily || selectedBrand || selectedType || "Catálogo"}
                subtitle={
                  activeFilters.length > 0
                    ? `${filtered.length} de ${visibleCatalog.length} produtos`
                    : `${filtered.length} produtos disponíveis`
                }
                actions={
                  <>
                    {/* No celular o painel vira gaveta, com o numero de filtros
                        ativos no proprio botao. */}
                    <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
                      <SheetTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 sm:h-8 gap-1.5 rounded-full border-border/60 px-3 text-xs font-medium lg:hidden"
                        >
                          <SlidersHorizontal className="h-3.5 w-3.5" />
                          Filtros
                          {activeFilters.length > 0 ? (
                            <span className="rounded-full bg-primary px-1.5 py-0.5 text-[0.6875rem] font-semibold text-primary-foreground">
                              {activeFilters.length}
                            </span>
                          ) : null}
                        </Button>
                      </SheetTrigger>
                      <SheetContent side="left" className="w-[min(88vw,20rem)] overflow-y-auto p-4">
                        <SheetHeader className="mb-2 text-left">
                          <SheetTitle className="text-base">Filtrar produtos</SheetTitle>
                        </SheetHeader>
                        <CatalogFilterPanel
                          brands={brandOptions}
                          types={typeOptions}
                          families={familyOptions}
                          selectedBrand={selectedBrand}
                          selectedType={selectedType}
                          selectedFamily={selectedFamily}
                          onlyPromotions={onlyPromotions}
                          promotionCount={promotionCount}
                          onBrandChange={setSelectedBrand}
                          onTypeChange={setSelectedType}
                          onFamilyChange={setSelectedFamily}
                          onOnlyPromotionsChange={setOnlyPromotions}
                          onClearAll={clearAllFilters}
                          activeFilterCount={activeFilters.length}
                        />
                        <Button
                          type="button"
                          className="mt-4 h-11 w-full rounded-full"
                          onClick={() => setFiltersOpen(false)}
                        >
                          Ver {filtered.length} produto(s)
                        </Button>
                      </SheetContent>
                    </Sheet>
                    <SortModeControl value={sortMode} onChange={setSortMode} />
                  </>
                }
              />

              <CatalogActiveFilters filters={activeFilters} onClearAll={clearAllFilters} />

              {isLoading ? (
                <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 min-[1680px]:grid-cols-5 min-[2200px]:grid-cols-6 min-[2500px]:grid-cols-7 min-[3000px]:grid-cols-8">
                  {Array.from({ length: 10 }).map((_, index) => (
                    <div key={index} className="overflow-hidden rounded-xl bg-background/70 ring-1 ring-black/5">
                      <Skeleton className="aspect-[4/5] w-full rounded-none" />
                    </div>
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 rounded-xl bg-background/70 px-6 py-16 text-center text-muted-foreground ring-1 ring-black/5">
                  <p className="text-lg font-medium text-foreground">Nenhum produto encontrado</p>
                  <p className="mt-1 text-sm">Tente ajustar os filtros ou a busca.</p>
                  {activeFilters.length > 0 ? (
                    <Button type="button" variant="outline" className="mt-5 rounded-full" onClick={clearAllFilters}>
                      Limpar filtros
                    </Button>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-4">
                  <div
                    ref={gridRef}
                    className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 min-[1680px]:grid-cols-5 min-[2200px]:grid-cols-6 min-[2500px]:grid-cols-7 min-[3000px]:grid-cols-8"
                  >
                    {visibleFiltered.map((product) => (
                      <CatalogProductCard
                        key={product.id}
                        product={product}
                        price={resolveProductPrice(product, customerPriceMap)}
                        precoBase={resolvePrecoBase(product, customerPriceMap)}
                        onAdd={handleRequestAdd}
                        inCart={cartIds.has(product.id)}
                        compact
                        isWishlisted={wishlistIds.includes(product.id)}
                        onToggleWishlist={() => toggleWishlist(product.id)}
                      />
                    ))}
                  </div>
                  {hasMoreProducts ? (
                    <div className="flex flex-col items-center gap-2 py-8">
                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        className="h-11 rounded-full border-border/60 px-8 text-sm font-medium shadow-sm transition-all hover:border-primary/40 hover:bg-primary/5"
                        onClick={showMoreProducts}
                      >
                        Carregar mais produtos
                      </Button>
                      <p className="text-xs tabular-nums text-muted-foreground">
                        {visibleFiltered.length} de {filtered.length}
                      </p>
                    </div>
                  ) : (
                    <p className="py-6 text-center text-[0.8125rem] text-muted-foreground">
                      {filtered.length === 1
                        ? "1 produto no catálogo."
                        : `Todos os ${filtered.length} produtos foram exibidos.`}
                    </p>
                  )}
                </div>
              )}
              </div>
            </section>

            {/* 2 lado a lado, antes de "Vistos recentemente". */}
            <PromoDuo label="Catálogo · 2" customerType={customerType} />

            {recentlyViewedProducts.length > 0 && (
              <ProductCarouselSection
                id="vistos-recentemente"
                title="Vistos recentemente"
                subtitle="Os últimos produtos que você abriu"
                products={recentlyViewedProducts}
                resolvePrice={(p) => resolveProductPrice(p, customerPriceMap)}
                resolvePrecoBase={(p) => resolvePrecoBase(p, customerPriceMap)}
                onAdd={handleRequestAdd}
                inCartIds={cartIds}
                wishlistIds={wishlistIds}
                toggleWishlist={toggleWishlist}
              />
            )}
        </div>
      </div>

      {/* Fora do container de proposito, e ultimo elemento da pagina: encosta no
          rodape sem folga nenhuma. O respiro de baixo foi para o container acima,
          senao ele entraria justamente entre o banner e o rodape.

          `-mb-16 lg:mb-0` anula o `pb-16` que o `<main>` do PublicLayout usa no
          celular para liberar a barra de navegacao fixa. Sem isso sobraria uma
          faixa de 64px entre o banner e a borda superior do rodape. */}
      <div className="-mb-16 lg:mb-0">
        <PromoUnico
          format="destaque"
          label="Catálogo · destaque final"
         
          bleed
          customerType={customerType}
        />
      </div>

      {showBackToTop ? (
        <Button
          variant="outline"
          size="icon"
          className="fixed bottom-24 right-4 z-40 h-10 w-10 rounded-full border-border/60 bg-background/90 shadow-md backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-300"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Voltar ao topo"
        >
          <ChevronUp className="h-5 w-5" />
        </Button>
      ) : null}

      <QuickView
        product={quickViewProduct ? (products.find((p) => p.id === quickViewProduct) ?? null) : null}
        open={quickViewProduct !== null}
        onOpenChange={(open) => { if (!open) setQuickViewProduct(null); }}
        price={quickViewProduct ? resolveProductPrice(products.find((p) => p.id === quickViewProduct)!, customerPriceMap) : 0}
        precoBase={quickViewProduct ? resolvePrecoBase(products.find((p) => p.id === quickViewProduct)!, customerPriceMap) : 0}
        onAdd={addToCart}
        inCart={quickViewProduct ? cartIds.has(quickViewProduct) : false}
        isWishlisted={quickViewProduct ? wishlistIds.includes(quickViewProduct) : false}
        onToggleWishlist={() => { if (quickViewProduct) toggleWishlist(quickViewProduct); }}
      />

    </div>
  );
}

function ProductCarouselSection({
  id,
  title,
  subtitle,
  products,
  resolvePrice,
  resolvePrecoBase,
  onAdd,
  inCartIds,
  wishlistIds,
  toggleWishlist,
}: {
  id?: string;
  title: string;
  subtitle?: string;
  products: Product[];
  resolvePrice: (product: Product) => number;
  resolvePrecoBase: (product: Product) => number;
  onAdd: (product: Product) => void;
  inCartIds: Set<string>;
  wishlistIds: string[];
  toggleWishlist: (id: string) => void;
}) {
  const [api, setApi] = useState<CarouselApi>();
  const [activeIndex, setActiveIndex] = useState(0);

  const onSelect = useCallback(() => {
    if (!api) return;
    setActiveIndex(api.selectedScrollSnap());
  }, [api]);

  useEffect(() => {
    if (!api || products.length === 0) return;
    const raf = requestAnimationFrame(() => {
      api.reInit();
    });
    return () => cancelAnimationFrame(raf);
  }, [api, products]);

  useEffect(() => {
    if (!api) return;
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        requestAnimationFrame(() => api.reInit());
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [api]);

  useEffect(() => {
    if (!api) return;
    onSelect();
    api.on("select", onSelect);
    api.on("reInit", onSelect);
    return () => {
      api.off("select", onSelect);
      api.off("reInit", onSelect);
    };
  }, [api, onSelect]);

  const totalSnaps = api ? api.scrollSnapList().length : 1;

  return (
    <section id={id} className="scroll-mt-[calc(var(--page-header-shell-height,88px)+4rem)]">
      <CatalogSectionHeader title={title} subtitle={subtitle} />
      <div className="group relative">
        <Carousel opts={{ align: "start", dragFree: false }} setApi={setApi}>
          <div className="mb-3 flex items-center justify-end gap-1.5">
            {totalSnaps > 1 && (
              <span className="text-xs tabular-nums text-muted-foreground">
                Página {activeIndex + 1}/{totalSnaps}
              </span>
            )}
            <CarouselPrevious
              className="relative inset-auto h-8 w-8 translate-y-0 rounded-full border border-border/60 bg-background text-muted-foreground shadow-sm hover:border-primary/30 hover:text-primary sm:h-9 sm:w-9"
              aria-label="Anterior"
            />
            <CarouselNext
              className="relative inset-auto h-8 w-8 translate-y-0 rounded-full border border-border/60 bg-background text-muted-foreground shadow-sm hover:border-primary/30 hover:text-primary sm:h-9 sm:w-9"
              aria-label="Próximo"
            />
          </div>
          <CarouselContent className="-ml-2 sm:-ml-3">
            {products.map((product) => (
              <CarouselItem key={product.id} className="basis-1/2 pl-2 sm:pl-2.5 sm:basis-1/3 lg:basis-1/4 xl:basis-1/5 min-[1680px]:basis-1/6 min-[2200px]:basis-[calc(100%/7)] min-[2500px]:basis-[calc(100%/8)] min-[3000px]:basis-[calc(100%/9)]">
                <CatalogProductCard
                  product={product}
                  price={resolvePrice(product)}
                  precoBase={resolvePrecoBase(product)}
                  onAdd={onAdd}
                  inCart={inCartIds.has(product.id)}
                  compact
                  isWishlisted={wishlistIds.includes(product.id)}
                  onToggleWishlist={() => toggleWishlist(product.id)}
                />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
        {totalSnaps > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2" role="tablist" aria-label={`Slides de ${title}`}>
            {Array.from({ length: totalSnaps }).map((_, index) => (
              <button
                key={`dot-${index}`}
                type="button"
                role="tab"
                aria-selected={activeIndex === index}
                aria-label={`Ir para slide ${index + 1}`}
                onClick={() => api?.scrollTo(index)}
                className={cn(
                  "h-2 rounded-full transition-all duration-300",
                  activeIndex === index ? "w-6 bg-primary" : "w-2 bg-foreground/20 hover:bg-foreground/40",
                )}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
