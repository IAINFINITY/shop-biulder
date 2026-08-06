import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImageIcon } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { findBannerSlot, formatEntrega } from "@/lib/bannerSlots";
import { useCatalogBanners } from "@/hooks/useCatalogBanners";
import { useAuth } from "@/hooks/useAuth";
import { useCustomerTypes } from "@/hooks/useCustomerTypes";
import { podeVer } from "@/lib/visibilidade";
import { resolverLinkDeBanner } from "@/lib/linkDeBanner";
import { cn } from "@/lib/utils";

const AUTOPLAY_MS = 5500;

// Faixa de largura total, na proporcao do arquivo que o time de design entrega.
//
// O jogo de artes oficiais tem 1920x600 para desktop (16:5) e 800x320 para
// celular (5:2). Adotando exatamente essas duas proporcoes, a arte de desktop
// nao perde nada, e no celular o corte fica nos 22% de largura que a peca de
// celular ja preve como sobra.
//
// O teto de 600px e a altura natural do arquivo: acima disso a imagem seria
// ampliada, o que nao acrescenta detalhe nenhum.
const slideImageClass = "absolute inset-0 block h-full w-full object-cover object-center";
const heroFrameClass =
  "relative aspect-[5/2] max-h-[600px] w-full overflow-hidden bg-muted sm:aspect-[16/5]";
const heroPlaceholderClass = cn(
  heroFrameClass,
  "flex flex-col items-center justify-center gap-1 border-y border-dashed border-border bg-muted/30 px-4 text-center",
);

type HeroSource = {
  webp: string;
  /** Nulo = servir so o WebP. */
  avif: string | null;
};

type HeroSlide = {
  desktop: HeroSource;
  /** Nulo = nao ha peca de celular; a de desktop e usada, cortada. */
  mobile: HeroSource | null;
  alt: string;
  label: string;
  linkUrl: string | null;
};

function HeroSlideFrame({
  slide,
  onLoad,
  onError,
}: {
  slide: HeroSlide;
  onLoad?: () => void;
  onError?: () => void;
}) {
  // Duas decisoes no mesmo `<picture>`, e o navegador resolve as duas de uma vez:
  //
  // 1. qual arte — a de celular ate 640px, a de desktop acima disso. Nao e a
  //    mesma imagem redimensionada: sao enquadramentos diferentes, com o texto
  //    reposicionado. Sem isso o celular recebia a de desktop cortada no centro,
  //    comendo justamente onde o titulo termina;
  // 2. qual formato — AVIF antes de WebP. Medido no arquivo oficial de 1920x600,
  //    o AVIF sai menor que o WebP e com um terco menos de erro por pixel.
  //
  // A ordem importa: o navegador para no primeiro `<source>` que satisfaz media
  // **e** formato. Por isso o par de celular vem antes do par de desktop.
  //
  // `<source>` de AVIF so aparece quando o arquivo existe: o fallback do
  // `<picture>` e por suporte de formato, nunca por erro de rede — uma URL
  // quebrada ali vira imagem quebrada, nao volta para o `<img>`.
  const mobile = slide.mobile;
  const content = (
    <picture>
      {mobile?.avif ? <source media="(max-width: 640px)" srcSet={mobile.avif} type="image/avif" /> : null}
      {mobile ? <source media="(max-width: 640px)" srcSet={mobile.webp} type="image/webp" /> : null}
      {slide.desktop.avif ? <source srcSet={slide.desktop.avif} type="image/avif" /> : null}
      <img
        src={slide.desktop.webp}
        alt={slide.alt}
        className={slideImageClass}
        width={1920}
        height={600}
        loading="eager"
        // Minusculo: o React 18 nao reconhece `fetchPriority` em camelCase —
        // avisa no console e nao emite o atributo. O spread evita o conflito com
        // a tipagem de `<img>`, que ainda so declara a forma camelCase.
        {...{ fetchpriority: "high" }}
        decoding="async"
        onLoad={onLoad}
        onError={onError}
      />
    </picture>
  );

  if (!slide.linkUrl) return content;

  /**
   * Sinal de que o banner leva a algum lugar.
   *
   * Imagem clicavel sem sinal nenhum nao convida clique: a pesquisa de affordance
   * e direta em dizer que a possibilidade real precisa de um **significante** —
   * cursor, sombra ou movimento. Aqui sao os tres, discretos: o cursor de mao vem
   * do proprio link, a arte cresce 2% e a caixa ganha sombra.
   *
   * `focus-visible` repete o mesmo efeito porque quem navega por teclado precisa
   * do mesmo aviso — sem isso o banner so existiria para quem usa mouse.
   *
   * `motion-safe` respeita quem pediu menos animacao no sistema; nesse caso fica
   * so a sombra, que nao se move.
   */
  const AFFORDANCE = [
    "group block h-full w-full overflow-hidden rounded-[inherit]",
    "transition-shadow duration-300 hover:shadow-[0_12px_32px_rgba(16,24,40,0.14)]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
    "focus-visible:shadow-[0_12px_32px_rgba(16,24,40,0.14)]",
    // `group-hover:` no lugar de encadear `motion-safe:hover:[&_img]:`, que o
    // Tailwind nao gerou — verificado no CSS compilado. `group-hover:` ja e usado
    // nos cards do catalogo, entao e caminho batido.
    "[&_img]:transition-transform [&_img]:duration-500",
    "motion-reduce:[&_img]:transition-none",
    "group-hover:[&_img]:scale-[1.02] group-focus-visible:[&_img]:scale-[1.02]",
  ].join(" ");

  // Mesmo resolvedor do PromoBanners: `startsWith("/")` tratava
  // `http://meusite.com/?categoria=Whey` como externo, abrindo aba nova para uma
  // pagina do proprio site — e, depois do deploy, para a maquina de quem colou o
  // endereco no admin.
  const destino = resolverLinkDeBanner(slide.linkUrl);
  if (!destino) return content;

  return destino.tipo === "interno" ? (
    <Link to={destino.para} viewTransition className={AFFORDANCE} aria-label={slide.label}>
      {content}
    </Link>
  ) : (
    <a href={destino.para} target="_blank" rel="noreferrer" className={AFFORDANCE} aria-label={slide.label}>
      {content}
    </a>
  );
}

type StoreHeroBannerProps = {
  customerType?: string | null;
  /** Area de onde vem a arte. Ver `bannerSlots.ts`. */
  slot?: string;
  /**
   * Gira entre varias artes.
   *
   * O topo do catalogo gira; a Central de ajuda usa o mesmo banner parado. Com
   * `false` a peca vira um quadro estatico — sem setas, sem pontinhos e sem
   * troca automatica, que sao justamente o que nao faz sentido com uma arte so.
   */
  carrossel?: boolean;
  rotulo?: string;
};

export function StoreHeroBanner({
  customerType,
  slot = "topo",
  carrossel = true,
  rotulo = "Destaques promocionais",
}: StoreHeroBannerProps) {
  // Mesma regra do catalogo: marcar todos os tipos vale o mesmo que nao marcar
  // nenhum, e quem e da casa ve tudo. Sem isso um banner marcado com a lista
  // inteira sumia justamente para quem acabou de cadastra-lo.
  const { isAdmin } = useAuth();
  const { options: tiposDeCliente } = useCustomerTypes();
  const todosOsTipos = useMemo(() => tiposDeCliente.map((tipo) => tipo.name), [tiposDeCliente]);

  const medida = findBannerSlot(slot);
  const [api, setApi] = useState<CarouselApi>();
  const [activeIndex, setActiveIndex] = useState(0);
  // Banner ativo cujo arquivo sumiu do storage virava um slide em branco, com
  // pontinho e tudo — o visitante via um espaco vazio sem entender o que era.
  // Some da vitrine; quem administra continua vendo o registro no admin.
  const [brokenImages, setBrokenImages] = useState<ReadonlySet<string>>(() => new Set());
  const { data: banners = [], isFetching } = useCatalogBanners({ activeOnly: true });

  const slides = useMemo<HeroSlide[]>(() => {
    return banners
      .filter((banner) => {
        // So a area pedida. Sem este recorte, arte cadastrada para o trio, o par
        // ou o destaque entraria no carrossel daqui — todas as linhas antigas
        // caem em "topo", entao nada que ja existe muda de lugar.
        if (banner.slot !== slot) return false;
        return podeVer(banner, { customerType, todosOsTipos, isAdmin });
      })
      .map((banner) => ({
        desktop: { webp: banner.image_url, avif: banner.image_url_avif ?? null },
        mobile: banner.image_url_mobile
          ? { webp: banner.image_url_mobile, avif: banner.image_url_mobile_avif ?? null }
          : null,
        alt: banner.label,
        label: banner.label,
        linkUrl: banner.link_url,
      }))
      .filter((slide) => !brokenImages.has(slide.desktop.webp));
  }, [banners, customerType, brokenImages, slot, todosOsTipos, isAdmin]);

  const handleImageError = useCallback((src: string) => {
    setBrokenImages((current) => {
      if (current.has(src)) return current;
      const next = new Set(current);
      next.add(src);
      return next;
    });
  }, []);

  const apiRef = useRef(api);
  apiRef.current = api;

  const loadedOnceRef = useRef(false);

  const reInitEmbla = useCallback(() => {
    const embla = apiRef.current;
    if (!embla) return;
    requestAnimationFrame(() => embla.reInit());
  }, []);

  const handleImageLoad = useCallback(() => {
    if (loadedOnceRef.current) return;
    loadedOnceRef.current = true;
    reInitEmbla();
  }, [reInitEmbla]);

  useEffect(() => {
    loadedOnceRef.current = false;
    if (!api || slides.length <= 1) return;
    const raf = requestAnimationFrame(() => api.reInit());
    return () => cancelAnimationFrame(raf);
  }, [api, slides]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        loadedOnceRef.current = false;
        reInitEmbla();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [reInitEmbla]);

  const onSelect = useCallback(() => {
    if (!api) return;
    setActiveIndex(api.selectedScrollSnap());
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

  useEffect(() => {
    if (!api || slides.length <= 1) {
      return;
    }

    const id = setInterval(() => {
      const embla = apiRef.current;
      if (!embla) return;
      if (embla.canScrollNext()) {
        embla.scrollNext();
      } else {
        embla.scrollTo(0);
      }
    }, AUTOPLAY_MS);

    return () => clearInterval(id);
  }, [api, slides.length]);

  return (
    <section
      // De ponta a ponta, como no site antigo: banner e a unica peca da pagina
      // que ganha em ocupar a tela toda.
      className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 overflow-hidden border-b border-border/40"
      aria-label={rotulo}
      {...(carrossel ? { "aria-roledescription": "carousel" } : {})}
    >
      <div className="w-full">
        {slides.length === 0 ? (
          // `initialData: []` faz o `data` chegar vazio antes do fetch responder,
          // entao so depois de `isFetching` cair o quadro explica o espaco vazio.
          // Enquanto isso, um fundo mudo sem texto — senao o "arte aqui" piscava
          // por um instante mesmo com arte cadastrada.
          isFetching ? (
            <div className={heroFrameClass} aria-hidden="true" />
          ) : (
            // Sem arte cadastrada, o quadro se explica em vez de virar uma faixa
            // cinza sem sentido para quem administra a loja.
            <div className={heroPlaceholderClass}>
              <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
              <p className="text-[0.8125rem] font-medium text-muted-foreground">Arte aqui</p>
              {medida ? (
                <p className="text-[0.6875rem] text-muted-foreground/70">
                  {rotulo} · {medida.proporcao} · {formatEntrega(medida)}
                </p>
              ) : null}
            </div>
          )
        ) : !carrossel ? (
          <div className={heroFrameClass}>
            <HeroSlideFrame
              slide={slides[0]}
              onLoad={handleImageLoad}
              onError={() => handleImageError(slides[0].desktop.webp)}
            />
          </div>
        ) : (
          <Carousel
            className="h-full w-full"
            opts={{ loop: true, align: "center", duration: 35 }}
            setApi={setApi}
          >
            <CarouselContent className="!ml-0 h-full">
              {slides.map((slide, index) => (
                <CarouselItem key={`${slide.alt}-${index}`} className="h-full basis-full !pl-0">
                  <div className={heroFrameClass}>
                    <HeroSlideFrame slide={slide} onLoad={handleImageLoad} onError={() => handleImageError(slide.desktop.webp)} />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>

            <CarouselPrevious
              className="left-3 top-1/2 h-8 w-8 -translate-y-1/2 border-0 bg-background/90 shadow-md hover:bg-background sm:left-4 sm:h-9 sm:w-9"
              aria-label="Banner anterior"
            />
            <CarouselNext
              className="right-3 top-1/2 h-8 w-8 -translate-y-1/2 border-0 bg-background/90 shadow-md hover:bg-background sm:right-4 sm:h-9 sm:w-9"
              aria-label="Próximo banner"
            />

            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2" role="tablist" aria-label="Slides do banner">
              {slides.map((slide, index) => (
                <button
                  key={`${slide.alt}-${index}`}
                  type="button"
                  role="tab"
                  aria-selected={activeIndex === index}
                  aria-label={`Ir para slide ${index + 1}`}
                  onClick={() => {
                    api.scrollTo(index);
                  }}
                  className={cn(
                    "h-2 rounded-full transition-all duration-300",
                    activeIndex === index ? "w-6 bg-primary" : "w-2 bg-foreground/30 hover:bg-foreground/50",
                  )}
                />
              ))}
            </div>
          </Carousel>
        )}
      </div>
    </section>
  );
}
