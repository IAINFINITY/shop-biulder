import { type FormEvent, type MouseEvent, type ReactNode, useId, useCallback, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Heart, ImageIcon, Search, User, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatBRL } from "@/lib/formatMoney";
import { PageHeaderShell } from "@/components/layout/PageHeaderShell";
import { ClinicPlusLogo } from "@/components/shared/ClinicPlusLogo";
import { caminhoDoProduto } from "@/lib/products";
import { cn } from "@/lib/utils";
import { CepLocationButton } from "@/components/catalogo/CepLocationButton";
import { useDeliveryCep } from "@/hooks/useDeliveryCep";
import { buildLoginPath } from "@/lib/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useWishlist } from "@/hooks/useWishlist";

export type StoreHeaderSearchSuggestion = {
  id: string;
  /** Para o link da sugestao usar o mesmo endereco do resto do catalogo. */
  product_code?: string | null;
  name: string;
  type: string;
  family: string;
  imageUrl?: string | null;
  price?: number | null;
};

export type StoreHeaderProps = {
  search: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit?: (value: string) => void;
  onSearchResultSelect?: () => void;
  cartSlot: ReactNode;
  searchSuggestions?: StoreHeaderSearchSuggestion[];
  filterNav?: ReactNode;
  searchHistory?: string[];
  onSearchHistoryClear?: () => void;
  onSearchHistoryRemove?: (term: string) => void;
  showSearchSuggestions?: boolean;
  /**
   * Versao reduzida, para as telas de login e recuperacao: so a logo.
   *
   * Medido em 08/08 na tela de login: com a barra completa, o primeiro campo do
   * formulario comecava a 573px do topo numa tela de 800px — 72% da tela antes
   * de dar para digitar. Busca, carrinho, CEP e favoritos nao servem a quem
   * esta tentando entrar; servem para distrair.
   *
   * As lojas de referencia fazem o mesmo. Medidas na mesma data, na propria
   * pagina de login: Amazon e Netshoes nao tem `<header>`; Mercado Livre tem
   * 55px com um link; Magazine Luiza tem 90px e **nenhum** link. Nenhuma
   * mantem busca ou carrinho.
   *
   * E a **mesma** barra, nao uma segunda: o motivo de esta tela ter passado a
   * usar o cabecalho da loja foi justamente acabar com duas barras diferentes
   * para a mesma funcao. Reduzir mantem isso — o que sai e o excesso, nao a
   * unidade.
   */
  minima?: boolean;
};

type SearchPanelProps = {
  search: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit?: (value: string) => void;
  onSearchResultSelect?: () => void;
  searchSuggestions: StoreHeaderSearchSuggestion[];
  showSuggestions: boolean;
  panelId: string;
  floating: boolean;
  compact?: boolean;
  variant: "mobile" | "desktop";
  showSubmitButton?: boolean;
  searchHistory?: string[];
  onSearchHistoryClear?: () => void;
  onSearchHistoryRemove?: (term: string) => void;
};

function SearchPanel({
  search,
  onSearchChange,
  onSearchSubmit,
  searchSuggestions,
  onSearchResultSelect,
  showSuggestions,
  panelId,
  floating,
  compact = false,
  variant,
  showSubmitButton = true,
  searchHistory = [],
  onSearchHistoryClear,
  onSearchHistoryRemove,
}: SearchPanelProps) {
  const [isFocused, setIsFocused] = useState(false);
  const showHistory = isFocused && search.trim().length === 0 && searchHistory.length > 0;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSearchSubmit?.(search);
  };

  /**
   * A largura da busca nunca passa do espaco que ela tem.
   *
   * O `xl` cravava `w-[48rem]` — 768px fixos. Como o painel e `absolute`, ele
   * esta fora do fluxo: o que sobra da largura nao empurra ninguem, passa por
   * cima. Num monitor de 1280px sobram ~490px para a busca, entao os 768px
   * invadiam ~140px de cada lado — em cima do CEP a esquerda e do "Entre /
   * Cadastre-se" a direita. Em monitor grande havia folga e o defeito nao
   * aparecia.
   *
   * `min(100%, 48rem)` mantem os 768px onde cabem e cede onde nao cabem. O
   * `100%` aqui e o container de busca, que ja e `flex-1`.
   */
  const wrapperClassName = floating
    ? "pointer-events-none absolute left-1/2 top-[calc((var(--page-header-shell-height,88px)-3rem)/2)] z-[70] w-full max-w-2xl -translate-x-1/2 px-4 lg:w-[min(100%,46rem)] lg:max-w-none lg:px-0 xl:w-[min(100%,48rem)]"
    : "relative w-full max-w-2xl lg:w-[min(100%,46rem)] lg:max-w-none xl:w-[min(100%,48rem)]";

  const cardClassName = floating
    ? "pointer-events-auto overflow-hidden rounded-2xl bg-background/95 ring-1 ring-black/5 shadow-[0_18px_50px_rgba(0,0,0,0.10)]"
    : "overflow-hidden rounded-xl bg-background/95 ring-1 ring-black/5 shadow-sm";

  return (
    <div className={wrapperClassName}>
      <div className={cardClassName}>
        <form onSubmit={handleSubmit} className="relative">
          <Input
            data-catalog-search={variant}
            type="search"
            placeholder="O que você procura?..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            className={cn(
              "h-12 w-full rounded-none border-0 bg-transparent pl-4 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 sm:pl-5",
              showSubmitButton ? "pr-14 sm:pr-16" : "pr-4 sm:pr-5",
              compact ? "sm:h-12" : "sm:h-14",
            )}
            aria-label="Buscar produtos"
            aria-controls={showSuggestions ? panelId : undefined}
            role="combobox"
            aria-expanded={showSuggestions}
            aria-autocomplete="list"
          />
          {showSubmitButton ? (
            <Button
              type="submit"
              size="icon"
              className={cn(
                "absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
                compact ? "h-8 w-8 sm:right-1.5" : "h-9 w-9 sm:right-2 sm:h-10 sm:w-10",
              )}
              aria-label="Buscar"
            >
              <Search className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
            </Button>
          ) : null}
        </form>

        {showHistory ? (
          <div id={panelId} className="border-t border-border/70 bg-card" role="listbox" aria-label="Buscas recentes">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Buscas recentes
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-10 sm:h-8 rounded-full px-3 text-xs"
                onClick={onSearchHistoryClear}
              >
                Limpar
              </Button>
            </div>
            <div className="max-h-60 overflow-y-auto p-2">
              {searchHistory.map((term) => (
                <button
                  key={term}
                  type="button"
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/70"
                  onClick={() => onSearchChange(term)}
                >
                  <div className="flex h-10 sm:h-9 w-10 sm:w-9 shrink-0 items-center justify-center rounded-full bg-muted/60">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">{term}</span>
                  <button
                    type="button"
                    className="rounded-full p-1 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSearchHistoryRemove?.(term);
                    }}
                    aria-label={`Remover "${term}" do histórico`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {showSuggestions ? (
          <div id={panelId} className="border-t border-border/70 bg-card" role="listbox" aria-label="Sugestões de produtos">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Resultados
                </p>
                <p className="text-sm text-foreground">
                  {searchSuggestions.length > 0
                    ? `${searchSuggestions.length} produto(s) encontrado(s)`
                    : "Nenhum resultado encontrado"}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-10 sm:h-8 rounded-full px-3 text-xs"
                onClick={() => onSearchChange("")}
              >
                Limpar
              </Button>
            </div>

            <div className="max-h-80 overflow-y-auto p-2">
              {searchSuggestions.length > 0 ? (
                searchSuggestions.map((item) => (
                  <Link
                    key={item.id}
                    to={caminhoDoProduto({ id: item.id, product_code: item.product_code ?? null, name: item.name })}
                    viewTransition
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/70"
                    onClick={() => {
                      onSearchResultSelect?.();
                      onSearchChange("");
                    }}
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-background">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name} width={1600} height={1600} loading="lazy" decoding="async" className="h-full w-full object-contain p-1" />
                      ) : (
                        <ImageIcon className="h-5 w-5 text-muted-foreground/35" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.type} · {item.family}
                      </p>
                    </div>

                    {typeof item.price === "number" && Number.isFinite(item.price) && (
                      <div className="shrink-0 text-right">
                        <p className="text-xs font-semibold tabular-nums text-foreground">{formatBRL(item.price)}</p>
                      </div>
                    )}
                  </Link>
                ))
              ) : (
                <div className="px-4 py-5 text-sm text-muted-foreground">Nenhum produto corresponde ao termo pesquisado.</div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function StoreHeader({
  search,
  onSearchChange,
  onSearchSubmit,
  onSearchResultSelect,
  cartSlot,
  searchSuggestions = [],
  filterNav,
  searchHistory,
  onSearchHistoryClear,
  onSearchHistoryRemove,
  showSearchSuggestions = true,
  minima = false,
}: StoreHeaderProps) {
  const trimmedSearch = search.trim();
  const showSuggestions = showSearchSuggestions && trimmedSearch.length > 0;
  const mobilePanelId = useId();
  const desktopPanelId = useId();
  const location = useLocation();
  const navigate = useNavigate();
  const { deliveryCep, saveDeliveryCep } = useDeliveryCep();
  const { user } = useAuth();
  const { ids: favoritosIds } = useWishlist();
  const totalFavoritos = favoritosIds.length;

  /**
   * Atalho para a lista de recompra, ao lado do carrinho.
   *
   * E onde ele vive em qualquer loja. Antes so dava para chegar na lista pela
   * Conta ou por um card da Ajuda — o "escondido em menu obscuro" que a NN/g
   * cobra.
   *
   * A forma copia a do "Minha conta" logo ao lado (mesma altura, mesmo raio,
   * mesma borda) em vez de ser um quadrado de icone solto: tres botoes vizinhos
   * com tres formas diferentes e o que fazia ele parecer enfiado ali.
   *
   * O rotulo so entra a partir de 1600px. Esta e a mesma linha onde o CEP ja
   * volta a aparecer em 1440px, e medido ali o rotulo custava 85px da busca —
   * que ja e a parte mais espremida do cabecalho.
   */
  const linkFavoritos = (
    <Link
      to="/favoritos"
      viewTransition
      aria-label={totalFavoritos > 0 ? `Minha lista — ${totalFavoritos} produto(s)` : "Minha lista"}
      className="relative inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-primary/20 px-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/5 min-[1600px]:px-3"
    >
      <Heart className="h-5 w-5" />
      <span className="hidden min-[1600px]:inline">Minha lista</span>
      {totalFavoritos > 0 ? (
        <span
          aria-hidden
          className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.625rem] font-semibold leading-none text-primary-foreground"
        >
          {totalFavoritos > 9 ? "9+" : totalFavoritos}
        </span>
      ) : null}
    </Link>
  );

  const handleLogoClick = useCallback((event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (location.pathname === "/") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    navigate("/", { state: { scrollToTop: true } });
  }, [location.pathname, navigate]);

  /**
   * Saida antecipada, e nao condicionais espalhadas.
   *
   * O cabecalho tem dois desenhos completos — um de celular e um de desktop —
   * e cada um com varias reducoes progressivas por largura. Enfiar `minima` em
   * cada ramo multiplicaria os casos e arriscaria a barra da loja, que funciona.
   * Aqui a versao reduzida e um bloco proprio, e o caminho da loja segue
   * intocado abaixo.
   */
  if (minima) {
    return (
      <div className="sticky top-0 z-50">
        <PageHeaderShell
          compact
          className="!relative border-b border-border/70 bg-card/95 shadow-sm backdrop-blur"
          innerClassName="flex items-center justify-center py-3 sm:py-4"
        >
          {/* Clicavel de proposito: e a unica saida da tela de login, e e onde
              todo mundo clica para voltar. Sem ela, a pessoa usa o botao de
              voltar do navegador — que num fluxo de cadastro perde o que ja foi
              digitado. */}
          <Link
            to="/"
            viewTransition
            aria-label="Voltar ao catálogo Clinic+"
            className="inline-block shrink-0"
            onClick={handleLogoClick}
          >
            <ClinicPlusLogo />
          </Link>
        </PageHeaderShell>
      </div>
    );
  }

  return (
    <div className="sticky top-0 z-50">
      <PageHeaderShell
        compact
        className="!relative border-b border-border/70 bg-card/95 shadow-sm backdrop-blur lg:hidden"
        innerClassName="flex-col items-stretch gap-2.5 py-3 sm:gap-4 sm:py-4"
      >
        <div className="flex w-full items-start gap-2">
          <div className="min-w-0 flex-1">
            <SearchPanel
              search={search}
              onSearchChange={onSearchChange}
              onSearchSubmit={onSearchSubmit}
              onSearchResultSelect={onSearchResultSelect}
              searchSuggestions={searchSuggestions}
              showSuggestions={showSuggestions}
              panelId={mobilePanelId}
              floating={false}
              compact
              variant="mobile"
              showSubmitButton={false}
              searchHistory={searchHistory}
              onSearchHistoryClear={onSearchHistoryClear}
              onSearchHistoryRemove={onSearchHistoryRemove}
            />
          </div>

          {/* No celular a lista tambem fica aqui, ao lado do carrinho. Ela nao
              esta na barra inferior — que ficou em Inicio · Carrinho · Conta de
              proposito — e sem este atalho so se chegava nela por dentro da
              Conta. */}
          <div className="shrink-0 pt-0.5">{linkFavoritos}</div>
          <div className="shrink-0 pt-0.5">{cartSlot}</div>
        </div>

        <CepLocationButton
          currentCep={deliveryCep}
          onCepResolved={saveDeliveryCep}
          className="w-full rounded-2xl border border-border/70 bg-background/90 px-4 py-3 shadow-sm"
        />
      </PageHeaderShell>

      <PageHeaderShell compact className="!relative hidden lg:flex" innerClassName="pt-3.5 sm:pt-0 sm:items-center">
            <div className="flex w-full items-center gap-4 xl:gap-6">
              {/* Logo + CEP */}
              <div className="flex items-center gap-4 shrink-0">
            <Link to="/" viewTransition className="inline-block shrink-0" onClick={handleLogoClick}>
              <ClinicPlusLogo />
            </Link>
            {/* Reducao progressiva: o CEP so entra quando sobra espaco de fato.
                
                Ele custa ~190px numa linha onde logo, conta e carrinho nao cedem
                (`shrink-0`). Em 1280px, mante-lo espremia a busca para ~490px;
                sem ele sobram ~680px. Consultar o CEP e uma acao ocasional, e a
                busca e o principal caminho do catalogo — entre os dois, quem sai
                primeiro e o CEP. Ele continua no cabecalho de celular. */}
            <div className="hidden h-8 w-px bg-border/50 min-[1440px]:block" />
            <div className="hidden min-[1440px]:block">
              <CepLocationButton
                currentCep={deliveryCep}
                onCepResolved={saveDeliveryCep}
              />
            </div>
          </div>

          {/* Search — flex-1, centered */}
          <div className="relative flex min-w-0 flex-1 items-center justify-center lg:min-h-[88px]">
            <div className="hidden w-full lg:block">
              <SearchPanel
                search={search}
                onSearchChange={onSearchChange}
                onSearchSubmit={onSearchSubmit}
                onSearchResultSelect={onSearchResultSelect}
                searchSuggestions={searchSuggestions}
                showSuggestions={showSuggestions}
                panelId={desktopPanelId}
                floating
                variant="desktop"
                searchHistory={searchHistory}
                onSearchHistoryClear={onSearchHistoryClear}
                onSearchHistoryRemove={onSearchHistoryRemove}
              />
            </div>
          </div>

          {/* User + Cart */}
          <div className="flex items-center justify-end gap-3 sm:gap-4 shrink-0">
            {/* Icone sozinho nao diz o que faz nem que ha conta a criar. Quem ja
                entrou ve o atalho da conta; quem nao, ve as duas acoes. */}
            {user ? (
              // h-10 e a altura do botao do carrinho ao lado: os dois precisam
              // fechar na mesma linha de base.
              <Link
                to="/conta"
                viewTransition
                className="hidden h-10 items-center gap-2 rounded-md border border-primary/20 px-4 text-sm font-medium text-primary transition-colors hover:bg-primary/10 lg:inline-flex"
              >
                <User className="h-5 w-5" />
                Minha conta
              </Link>
            ) : (
              <Link
                to={buildLoginPath()}
                viewTransition
                className="hidden h-10 items-center gap-2 rounded-md border border-primary/20 px-3 leading-none transition-colors hover:bg-primary/10 lg:inline-flex"
              >
                <User className="h-5 w-5 shrink-0 text-primary" />
                {/* Empilhado: duas acoes distintas, uma sobre a outra, no lugar
                    de uma frase corrida. */}
                <span className="flex flex-col items-start gap-0.5">
                  <span className="text-[0.8125rem] font-semibold leading-none text-primary underline underline-offset-2">
                    Entre
                  </span>
                  <span className="text-[0.8125rem] font-semibold leading-none text-primary underline underline-offset-2">
                    Cadastre-se
                  </span>
                </span>
              </Link>
            )}
            {linkFavoritos}
            <div className="hidden items-center lg:flex">{cartSlot}</div>
          </div>
        </div>
      </PageHeaderShell>
      {filterNav}
    </div>
  );
}
