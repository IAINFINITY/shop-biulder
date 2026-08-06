import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Heart, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { CatalogSectionHeader } from "@/components/catalogo/CatalogSectionHeader";
import { ConfirmActionDialog } from "@/components/shared/ConfirmActionDialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useCustomerPricing } from "@/hooks/useCustomerPricing";
import { useProducts } from "@/hooks/useProducts";
import { useWishlist } from "@/hooks/useWishlist";
import { itensParaCarrinho, MAX_QUANTIDADE } from "@/lib/favoritos";
import { formatBRL } from "@/lib/formatMoney";
import { EMPTY_PRICE_MAP, resolveProductPrice } from "@/lib/pricing";
import { resolveProductImageUrls, caminhoDoProduto } from "@/lib/products";
import { CARTAO } from "@/lib/superficies";
import { cn } from "@/lib/utils";

/**
 * A lista de recompra.
 *
 * Substitui o `?view=favoritos`, que era query param na home — nao dava para
 * fixar, sumia do historico e obrigava Conta e Ajuda a linkarem na mao. E
 * substitui tambem o carrossel "Meus favoritos" que existia dentro do catalogo:
 * duas telas com o mesmo titulo e o mesmo conteudo e o que a NN/g aponta como
 * mecanismo de salvamento conflitante.
 *
 * O que muda de fato e a acao em lote. Antes a lista so listava, e por isso nao
 * servia para nada num catalogo B2B: quem recompra quer marcar o que vai pedir,
 * ajustar quantidade e mandar tudo de uma vez.
 */
export default function Favoritos() {
  const { data: products = [] } = useProducts();
  const { customerProfile } = useAuth();
  const { data: customerPriceMap = EMPTY_PRICE_MAP } = useCustomerPricing(
    customerProfile?.customer_type ?? null,
    customerProfile?.proxis_tpr_id ?? null,
  );
  const { itens, setQuantity, remove, clear } = useWishlist();
  const { addToCart } = useCart();

  /**
   * Ids resolvidos, na ordem da lista.
   *
   * Produto que saiu de linha some da tela mas **continua na lista** — o hook so
   * remove por acao do cliente. Apagar a preferencia dele porque um item ficou
   * inativo por uma semana seria perda de dado.
   */
  const linhas = useMemo(() => {
    const porId = new Map(products.map((p) => [p.id, p]));
    return itens
      .map((item) => ({ item, produto: porId.get(item.productId) }))
      .filter((linha): linha is { item: typeof linha.item; produto: NonNullable<typeof linha.produto> } =>
        Boolean(linha.produto),
      );
  }, [itens, products]);

  const [selecionados, setSelecionados] = useState<ReadonlySet<string>>(() => new Set());

  // Selecao so vale para o que esta na tela: id que nao resolve nao pode entrar
  // no carrinho, entao manter marcado confundiria a contagem do rodape.
  const selecionadosValidos = useMemo(
    () => new Set(linhas.filter((l) => selecionados.has(l.item.productId)).map((l) => l.item.productId)),
    [linhas, selecionados],
  );

  const todosMarcados = linhas.length > 0 && selecionadosValidos.size === linhas.length;

  const alternarTodos = useCallback(() => {
    setSelecionados(todosMarcados ? new Set() : new Set(linhas.map((l) => l.item.productId)));
  }, [linhas, todosMarcados]);

  const alternarUm = useCallback((productId: string) => {
    setSelecionados((anteriores) => {
      const proximos = new Set(anteriores);
      if (proximos.has(productId)) proximos.delete(productId);
      else proximos.add(productId);
      return proximos;
    });
  }, []);

  const totalSelecionado = useMemo(
    () =>
      linhas
        .filter((l) => selecionadosValidos.has(l.item.productId))
        .reduce((soma, l) => soma + resolveProductPrice(l.produto, customerPriceMap) * l.item.quantity, 0),
    [linhas, selecionadosValidos, customerPriceMap],
  );

  const enviarAoCarrinho = useCallback(() => {
    const paraAdicionar = itensParaCarrinho(itens, selecionadosValidos, products);
    if (paraAdicionar.length === 0) return;

    for (const { produto, quantidade } of paraAdicionar) {
      addToCart(produto, quantidade);
    }

    toast.success(
      paraAdicionar.length === 1
        ? "1 produto adicionado ao carrinho"
        : `${paraAdicionar.length} produtos adicionados ao carrinho`,
    );
    setSelecionados(new Set());
  }, [addToCart, itens, products, selecionadosValidos]);

  const removerSelecionados = useCallback(() => {
    remove([...selecionadosValidos]);
    setSelecionados(new Set());
  }, [remove, selecionadosValidos]);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-3 py-4 sm:px-6 sm:py-8">
      <CatalogSectionHeader
        title="Minha lista"
        subtitle={
          linhas.length === 1 ? "1 produto salvo" : `${linhas.length} produtos salvos`
        }
        actions={
          linhas.length > 0 ? (
            <ConfirmActionDialog
              trigger={
                <Button type="button" variant="ghost" className="h-10 rounded-full px-4 text-sm text-destructive">
                  Limpar lista
                </Button>
              }
              title="Limpar lista"
              description="Isso remove todos os produtos salvos na sua lista de recompra."
              confirmLabel="Limpar"
              destructive
              onConfirm={() => {
                clear();
                setSelecionados(new Set());
              }}
            />
          ) : null
        }
      />

      {linhas.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-border/70 bg-background/80 px-6 py-14 text-center">
          <Heart className="mx-auto h-10 w-10 text-muted-foreground/35" />
          <p className="mt-4 text-lg font-semibold text-foreground">Sua lista está vazia</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Marque produtos com o coração para salvar aqui e pedir de novo depois.
          </p>
          <Button asChild className="mt-5 rounded-full">
            <Link to="/" viewTransition>
              Ir para o catálogo
            </Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-4 flex items-center gap-3 px-1">
            <Checkbox
              id="favoritos-todos"
              checked={todosMarcados}
              onCheckedChange={alternarTodos}
              aria-label="Selecionar todos os produtos da lista"
            />
            <label htmlFor="favoritos-todos" className="cursor-pointer text-sm font-medium text-foreground">
              Selecionar todos
            </label>
          </div>

          <ul className="mt-3 space-y-2">
            {linhas.map(({ item, produto }) => {
              const preco = resolveProductPrice(produto, customerPriceMap);
              const marcado = selecionadosValidos.has(item.productId);
              const capa = resolveProductImageUrls(produto.image_url, produto.image_urls)[0] ?? null;

              return (
                <li
                  key={item.productId}
                  className={cn(
                    CARTAO,
                    "flex flex-wrap items-center gap-3 p-3 transition-colors sm:flex-nowrap sm:gap-4 sm:p-4",
                    marcado && "ring-primary/30",
                  )}
                >
                  <Checkbox
                    checked={marcado}
                    onCheckedChange={() => alternarUm(item.productId)}
                    aria-label={`Selecionar ${produto.name}`}
                    className="shrink-0"
                  />

                  <Link
                    to={caminhoDoProduto(produto)}
                    viewTransition
                    className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4"
                  >
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted/30 sm:h-16 sm:w-16">
                      {capa ? (
                        <img
                          src={capa}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-contain"
                        />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{produto.name}</span>
                      {produto.product_code ? (
                        <span className="block text-[0.6875rem] text-muted-foreground">
                          Cód. {produto.product_code}
                        </span>
                      ) : null}
                      <span className="mt-0.5 block text-sm font-semibold text-foreground sm:hidden">
                        {formatBRL(preco)}
                      </span>
                    </span>
                  </Link>

                  <div className="flex shrink-0 items-center gap-1 rounded-full border border-border/70 p-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      aria-label={`Diminuir quantidade de ${produto.name}`}
                      disabled={item.quantity <= 1}
                      onClick={() => setQuantity(item.productId, item.quantity - 1)}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="min-w-8 text-center text-sm font-semibold tabular-nums">
                      {item.quantity}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      aria-label={`Aumentar quantidade de ${produto.name}`}
                      disabled={item.quantity >= MAX_QUANTIDADE}
                      onClick={() => setQuantity(item.productId, item.quantity + 1)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  <span className="hidden w-28 shrink-0 text-right text-sm font-semibold text-foreground sm:block">
                    {formatBRL(preco * item.quantity)}
                  </span>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:text-destructive"
                    aria-label={`Remover ${produto.name} da lista`}
                    onClick={() => remove([item.productId])}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              );
            })}
          </ul>

          {/* `sticky`, e nao `fixed`.

              Fixa, a barra ficava presa no fim da **janela** — entao com poucos
              favoritos a pagina era curta, o rodape entrava na tela e a barra
              flutuava por cima dele. Medido: rodape comecando em 639px e a barra
              em 726px, sobrepostos.

              `sticky` mantem a barra colada enquanto a lista rola e a solta
              quando o conteudo acaba, entao ela nunca invade o rodape. E, por
              continuar no fluxo, dispensa o `padding` que a lista precisava para
              nao terminar embaixo dela.

              No celular ela para acima da barra de navegacao inferior, que e
              `fixed` com 3.5rem. */}
          <div className="sticky bottom-0 z-30 mt-3 -mx-3 border-t border-border bg-card/95 backdrop-blur-lg max-lg:bottom-[calc(3.5rem+env(safe-area-inset-bottom,0rem))] sm:-mx-6">
            <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center gap-2 px-3 py-3 sm:flex-nowrap sm:gap-3 sm:px-6">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">
                  {selecionadosValidos.size === 0
                    ? "Nenhum produto selecionado"
                    : selecionadosValidos.size === 1
                      ? "1 produto selecionado"
                      : `${selecionadosValidos.size} produtos selecionados`}
                </p>
                {selecionadosValidos.size > 0 ? (
                  <p className="text-[0.8125rem] text-muted-foreground">Total {formatBRL(totalSelecionado)}</p>
                ) : null}
              </div>

              {selecionadosValidos.size > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 shrink-0 rounded-full px-3 text-sm text-destructive"
                  onClick={removerSelecionados}
                >
                  Remover
                </Button>
              ) : null}

              <Button
                type="button"
                className="h-11 shrink-0 rounded-full px-5 text-sm"
                disabled={selecionadosValidos.size === 0}
                onClick={enviarAoCarrinho}
              >
                <ShoppingCart className="mr-2 h-4 w-4" />
                Adicionar ao carrinho
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
